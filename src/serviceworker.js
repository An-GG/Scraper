// serviceworker.js
// Serves Firebase Clients, Utilizes corescraper.
// Copyright (c) Ankush Girotra 2019. All rights reserved.

var corescraper = require("./corescraper.js");
var signup = require("./signupflow.js");
var fb = require('firebase-admin');
var tokens = require('./tokens.js');
var serviceAccount = require("./../echelon-f16f8-firebase-adminsdk-ytuzc-7e23c999b7.json");
var mwc = require('./mwc.js');
var idgenerator = require('./idgenerator.js');

var WORKER_ID = "";
const SCRAPER_DELAY = 100;

// Initialize
async function initializeApp() {
  // Generate Server ID
  WORKER_ID = idgenerator.randString(15);

  await fb.initializeApp({
    credential: fb.credential.cert(serviceAccount),
    databaseURL: "https://echelon-f16f8.firebaseio.com/"
  });
  await corescraper.initializeApp();
  //await signup.initializeApp(WORKER_ID, fb, corescraper);
  await mwc.initializeApp(WORKER_ID, fb);
}



async function test() {
  await initializeApp();
  await mwc.trackWorkers();
  await mwc.checkIn();
  await mwc.synchronizeClients();
  //let data = await corescraper.getUserSnapshot("STUDENT\\s1620641", "YellowRiver812");

  //await fb.database().ref('data').push(data);
}



async function startScraperLoop() {
  let clients = mwc.assignedClients;

  // Get Least Recently Updated Client
  let sid = getLeastRecentlyUpdatedKey(clients);
  let value = clients[sid];

  // For Each PW, Do A Scrape
  Object.enteries(value).forEach(passwordEntry => {
    let password = passwordEntry[0];
    let fb_ids = passwordEntry[1].associatedUsers;
    let data = await scrapeStandard(sid, password);
    // For Each FB ID Assigned To This PW, Update User
    for (var fb_id of fb_ids) {
      await updateFBUser(fb_id, sid, data);
    }
  });

  setTimeout(startScraperLoop, SCRAPER_DELAY);
}

function getLeastRecentlyUpdatedKey(object) {
  var leastRecentKey = "";
  var leastRecentTime = (new Date() * 1);
  Object.entries(object).forEach(entry => {
    let key = entry[0];
    let value = entry[1];

    Object.enteries(object).forEach(passwordEntry => {
      let time = passwordEntry.lastUpdated;
      if (time < leastRecentTime) {
        leastRecentKey = key;
        leastRecentTime = time;
      }
    });

  });
  return leastRecentKey;
}

async function scrapeStandard(sid, pass) {
  var sessionID = await createSession(sid, pass);
  await initializeSession(sessionID);
  await navigateAndAttemptLogin(sessionID);
  await openGradebook(sessionID);
  let lightweight_snapshot = JSON.parse(JSON.stringify(await scraper.scrapeUndetailedGrades(sessionID)));
  let full_snapshot = await scrapeDetailedGrades(sessionID);
  let data = [lightweight_snapshot, full_snapshot];
  return data;
}

async function updateFBUser(fb_id, psc_id, data) {
  
}


test();
