// serviceworker.js
// Serves Firebase Clients, Utilizes corescraper.
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var corescraper = require("./corescraper.js");
var signup = require("./signupflow.js");
var fb = require('firebase-admin');
var serviceAccount = require("./../echelon-f16f8-firebase-adminsdk-ytuzc-7e23c999b7.json");

// Initialize
async function initializeApp() {
  await fb.initializeApp({
    credential: fb.credential.cert(serviceAccount),
    databaseURL: "https://echelon-f16f8.firebaseio.com/"
  });
  await corescraper.initializeApp();
  await signup.initializeApp(fb, corescraper);

}



async function test() {
  await initializeApp();
  //let data = await corescraper.getUserSnapshot("STUDENT\\s1620641", "YellowRiver812");

  //await fb.database().ref('data').push(data);

  signup.handleUserSignUp('S1620641', 'YellowRiver812', 'ANOTHER_SAMPLE_FIREBASE_ID');
}


test();
