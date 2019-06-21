// idgenerator.js
// Generates Random String Of Characters
// Copyright (c) Ankush Girotra 2019. All rights reserved.

function randString(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

// EXPORTS

module.exports = {
  randString: randString
}
