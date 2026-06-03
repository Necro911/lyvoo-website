<script type="module">

  // Import the functions you need from the SDKs you need

  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-analytics.js";

  // TODO: Add SDKs for Firebase products that you want to use

  // https://firebase.google.com/docs/web/setup#available-libraries

  import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

  // Your web app's Firebase configuration

  // For Firebase JS SDK v7.20.0 and later, measurementId is optional

  const firebaseConfig = {

    apiKey: "AIzaSyDdz33PHjwC5vDqSMh9ts1H7Q1tuJG6H38",

    authDomain: "lyvoo-9d54b.firebaseapp.com",

    projectId: "lyvoo-9d54b",

    storageBucket: "lyvoo-9d54b.firebasestorage.app",

    messagingSenderId: "623275965506",

    appId: "1:623275965506:web:33c71a522b966b044381db",

    measurementId: "G-GJ7JRSVLY6"

  };


  // Initialize Firebase

  const app = initializeApp(firebaseConfig);

  //inputs
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  //submit button

  const submit = document.getElementById('submit');
  submit.addEventListener("click", function (event) {
    event.preventDefault()
    alert(5)
  })

  const analytics = getAnalytics(app);

</script>