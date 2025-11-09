// Firebase configuration
// Replace with your Firebase config from console -> Project settings -> SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyCZ_eQonlY2OxSyJt55Efjr8TH1BYGIQ-Q",
  authDomain: "house-expense-a4c13.firebaseapp.com",
  projectId: "house-expense-a4c13"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Example Firestore test
db.collection("test").add({timestamp: new Date()}).then(()=>console.log("Firebase Connected"));

// rest of your JS logic here (charts, entries, UI etc.)
