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
var diff = require('./deepDifference.js');

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
  setTimeout(startScraperLoop, 2000);
}

var clients = {}
var durations = [];

function logStats() {
  var sum = 0;
  for (let duration of durations) {
    sum+=duration;
  }
  let average = (sum / durations.length) / 1000;
  let last = durations[durations.length - 1] / 1000;
  let cycle = durations.length;
  console.log('CYCLE DURATION: '+ last +' | AVERAGE: ' + average + ' | CYCLE: ' + cycle);
}

async function startScraperLoop() {
  let startTime = (new Date() * 1);
  clients = mwc.taskRefactor();

  // Get Least Recently Updated Client
  let sid = getLeastRecentlyUpdatedKey(clients);
  let value = clients[sid];


  // For Each PW, Do A Scrape
  for (let password of Object.keys(value)) {
    let fb_ids = value[password].associatedUsers;
    let data = await scrapeStandard(sid, password);
    // For Each FB ID Assigned To This PW, Update User
    for (var fb_id of fb_ids) {
      await updateFBUser(fb_id, sid, data, password);
    }
  }
  let duration = (new Date() * 1) - startTime;
  durations.push(duration);
  logStats();
  setTimeout(startScraperLoop, SCRAPER_DELAY);
}

function getLeastRecentlyUpdatedKey(object) {
  var leastRecentKey = "";
  var leastRecentTime = (new Date() * 1);
  console.log(object);
  console.log(Object.keys(object));
  for (let key of Object.keys(object)) {
    let value = object[key];
    console.log(key);
    for (let password of Object.keys(value)) {
      let passwordEntry = value[password];
      let time = passwordEntry.lastUpdated;
      if (time < leastRecentTime) {
        leastRecentKey = key;
        leastRecentTime = time;
      }
    }
  }
  return leastRecentKey;
}

async function scrapeStandard(sid, pass) {
  var sessionID = await corescraper.createSession(sid, pass);
  await corescraper.initializeSession(sessionID);
  await corescraper.navigateAndAttemptLogin(sessionID);
  // TODO: Add error handle for sign in fail
  await corescraper.openGradebook(sessionID);
  let lightweight_snapshot = JSON.parse(JSON.stringify(await corescraper.scrapeUndetailedGrades(sessionID)));
  let full_snapshot = await corescraper.scrapeDetailedGrades(sessionID);
  await corescraper.endSession(sessionID);
  let data = [lightweight_snapshot, full_snapshot];
  return data;
}

async function updateFBUser(fb_id, psc_id, data, pw) {
  // TODO: Add error handling failed data

  // SET NEW DATA
  let dataRef = fb.database().ref('data/' + fb_id + '/' + psc_id);
  await dataRef.update({
    lightweight_snapshot: data[0],
    full_snapshot: data[1]
  });

  // TOOD: CREATE TRACKING
  let rebuiltSnap = await mwc.getRebuiltSnapshot(psc_id, fb_id);
  let currentSnap = data[1];
  let updates = diff.getChanges(rebuiltSnap, currentSnap);
  if (Object.keys(updates) != 0) {
    let trackingRef = dataRef.child('tracking');
    await trackingRef.push(updates);
  }



  // SET NEW LAST UPDATED
  let time = (new Date() * 1);
  if (clients[psc_id] != null) { // TODO : Check if this actually works
    var client = clients[psc_id][pw];
    client.lastUpdated = time;
  }
  let timeRef = fb.database().ref('hisd_clients/' + psc_id + '/' + pw + '/lastUpdated');
  await timeRef.set(time);
}


test();
