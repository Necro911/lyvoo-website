#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
sync-check.py
Compara secções entre index.html (PT) e en/index.html (EN).
Corre antes de fazer push para garantir que nenhuma secção ficou dessincronizada.

Uso:
    python sync-check.py              # verifica todas as secções
    python sync-check.py --section planos   # verifica só uma secção
"""

import re
import difflib
import argparse

# Secções a comparar: (id_PT, id_EN)
# Secções com conteúdo traduzido mas estrutura paralela
SECTIONS = [
    ("processo",     "processo"),
    ("problema",     "problema"),
    ("atlas",        "atlas"),
    ("modulos",      "modulos"),
    ("condicoes",    "condicoes"),
    ("suplementacao","suplementacao"),
    ("app",          "app"),
    ("evidencia",    "evidencia"),
    ("testemunhos",  "testemunhos"),
    ("equipa",       "equipa"),
    ("planos",       "planos"),
    ("glp-friendly", "glp-friendly"),
]

# Atributos/padrões que devem ter o mesmo número de ocorrências
STRUCTURAL_PATTERNS = [
    (r'<div\s+class="[^"]*step-detail[^"]*"',   "step-detail blocks"),
    (r'<div\s+class="[^"]*bm-bullet[^"]*"',     "biomarker bullets"),
    (r'<div\s+class="[^"]*glp-concern[^"]*"',   "GLP concerns"),
    (r'<div\s+class="[^"]*how-card[^"]*"',      "how-it-works cards"),
    (r'<div\s+class="[^"]*cf-step[^"]*"',       "como-funciona steps"),
    (r'<a\s[^>]*class="[^"]*nav-cta[^"]*"',     "nav CTA buttons"),
]

# Secções que têm versões intencionalmente condensadas em EN — avisa mas não marca como erro
CONDENSED_EN_SECTIONS = {"testemunhos", "equipa", "planos", "glp-friendly", "app", "problema", "processo"}


def load(path):
    with io.open(path, encoding="utf-8") as f:
        return f.read()


def extract_section(html, section_id):
    """Extrai o bloco HTML que contém id='section_id', incluindo a tag raiz."""
    # encontra o ponto onde aparece o id
    pattern = re.compile(
        r'(<(?:section|div|article)[^>]*\bid=["\']' + re.escape(section_id) + r'["\'][^>]*>)',
        re.IGNORECASE
    )
    m = pattern.search(html)
    if not m:
        return None

    start = m.start()
    tag_name = re.match(r'<(\w+)', m.group(1)).group(1)

    # conta abertura/fecho da tag para encontrar o fim correto
    depth = 0
    i = start
    open_tag  = re.compile(r'<'  + tag_name + r'[\s>]', re.IGNORECASE)
    close_tag = re.compile(r'</' + tag_name + r'\s*>',  re.IGNORECASE)

    while i < len(html):
        open_m  = open_tag.search(html, i)
        close_m = close_tag.search(html, i)

        if open_m and (not close_m or open_m.start() < close_m.start()):
            depth += 1
            i = open_m.end()
        elif close_m:
            depth -= 1
            i = close_m.end()
            if depth == 0:
                return html[start:i]
        else:
            break

    return html[start:]


def strip_tags(html):
    """Remove todas as tags HTML, mantém só o texto."""
    return re.sub(r'<[^>]+>', ' ', html)


def normalize_text(html):
    """Texto limpo e normalizado para comparação de estrutura."""
    text = strip_tags(html)
    # colapsa espaços e linhas em branco
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def count_pattern(html, pattern):
    return len(re.findall(pattern, html, re.IGNORECASE))


def section_line_count(html):
    """Número de linhas não-vazias do bloco."""
    return sum(1 for l in html.splitlines() if l.strip())


# -- Cores ANSI ----------------------------------------------
RED    = "\033[91m"
YELLOW = "\033[93m"
GREEN  = "\033[92m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def main():
    parser = argparse.ArgumentParser(description="Verifica sync PT ↔ EN")
    parser.add_argument("--section", help="Verifica só esta secção (pelo id)")
    parser.add_argument("--diff", action="store_true", help="Mostra diff de texto para secções divergentes")
    args = parser.parse_args()

    pt_html = load("index.html")
    en_html = load("en/index.html")

    sections = SECTIONS
    if args.section:
        sections = [(s, e) for s, e in SECTIONS if s == args.section or e == args.section]
        if not sections:
            print(f"{RED}Secção '{args.section}' não encontrada na lista.{RESET}")
            sys.exit(1)

    warnings = 0
    errors   = 0

    print(f"\n{BOLD}{'-'*60}{RESET}")
    print(f"{BOLD}  Lyvoo sync-check · PT ↔ EN{RESET}")
    print(f"{BOLD}{'-'*60}{RESET}\n")

    # -- 1. Secções estruturais ------------------------------
    print(f"{CYAN}{BOLD}Secções HTML{RESET}")
    for pt_id, en_id in sections:
        pt_sec = extract_section(pt_html, pt_id)
        en_sec = extract_section(en_html, en_id)

        if pt_sec is None and en_sec is None:
            print(f"  {YELLOW}⚠  #{pt_id} — não encontrado em nenhum ficheiro{RESET}")
            warnings += 1
            continue
        if pt_sec is None:
            print(f"  {RED}✗  #{pt_id} — ausente no PT{RESET}")
            errors += 1
            continue
        if en_sec is None:
            print(f"  {RED}✗  #{en_id} — ausente no EN{RESET}")
            errors += 1
            continue

        pt_lines = section_line_count(pt_sec)
        en_lines = section_line_count(en_sec)
        diff_pct  = abs(pt_lines - en_lines) / max(pt_lines, 1) * 100

        is_condensed = pt_id in CONDENSED_EN_SECTIONS or en_id in CONDENSED_EN_SECTIONS

        if diff_pct > 25:
            if is_condensed:
                print(f"  {YELLOW}~  #{pt_id}{RESET}  PT={pt_lines} linhas  EN={en_lines} linhas  (versão EN condensada)")
                warnings += 1
            else:
                print(f"  {RED}✗  #{pt_id}{RESET}  PT={pt_lines} linhas  EN={en_lines} linhas  ({diff_pct:.0f}% diferença — pode estar dessincronizado)")
                errors += 1
            if args.diff and not is_condensed:
                pt_words = normalize_text(pt_sec).split()
                en_words = normalize_text(en_sec).split()
                ratio = difflib.SequenceMatcher(None, pt_words, en_words).ratio()
                print(f"     similaridade de texto: {ratio*100:.0f}%")
        elif diff_pct > 10:
            print(f"  {YELLOW}⚠  #{pt_id}{RESET}  PT={pt_lines} linhas  EN={en_lines} linhas  ({diff_pct:.0f}% diferença)")
            warnings += 1
        else:
            print(f"  {GREEN}✓  #{pt_id}{RESET}  PT={pt_lines}  EN={en_lines} linhas")

    # -- 2. Padrões estruturais (conta ocorrências) ----------
    print(f"\n{CYAN}{BOLD}Contagem de elementos{RESET}")
    for pattern, label in STRUCTURAL_PATTERNS:
        pt_n = count_pattern(pt_html, pattern)
        en_n = count_pattern(en_html, pattern)
        if pt_n != en_n:
            print(f"  {RED}✗  {label:<30}{RESET}  PT={pt_n}  EN={en_n}")
            errors += 1
        else:
            print(f"  {GREEN}✓  {label:<30}{RESET}  {pt_n} em cada")

    # -- Resumo ----------------------------------------------
    print(f"\n{BOLD}{'-'*60}{RESET}")
    if errors == 0 and warnings == 0:
        print(f"{GREEN}{BOLD}  Tudo sincronizado. ✓{RESET}")
    else:
        if errors:
            print(f"{RED}{BOLD}  {errors} erro(s)  {warnings} aviso(s){RESET}")
        else:
            print(f"{YELLOW}{BOLD}  {warnings} aviso(s) — verifique manualmente{RESET}")
    print(f"{BOLD}{'-'*60}{RESET}\n")

    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
