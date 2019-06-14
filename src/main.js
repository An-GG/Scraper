// main.js
// Lowest Level Scraping Function
// Copyright (c) Ankush Girotra 2019. All rights reserved.

const puppeteer = require('puppeteer');


const PSCONNECT_URL = "https://publicapps.houstonisd.org/ParentStudentConnect/GradeSpeed.aspx";
async function getData(input_username, input_password) {

  // SETUP, USE SINGLE BROWSER INSTANCE LATER
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  // NEW PAGE FOR USER
  await page.goto(PSCONNECT_URL);

  // LOGIN USING GIVEN CREDENTIALS
  await page.type("#ctl00_ContentArea_txtUserName", input_username);
  await page.type("#ctl00_ContentArea_txtPassword", input_password);
  await page.click("#ctl00_ContentArea_btnLogin");

  // LOGIN FAILURE CHECK
  await page.waitForSelector('#ctl00_ContentArea_Btn_Gradebook');

  // CHECK IF FRAME LOADED SUCCESSFULLY




}



// TESTING
getData("STUDENT\\s1620641", "YellowRiver812");
