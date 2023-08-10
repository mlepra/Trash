// ==UserScript==
// @author tenuco
// @name Sokker Players Improve
// @description Sokker Players Improve Info
// @namespace sokker.org
// @match https://sokker.org/es/app/squad/*
// @version 1.1.3
// @grant none
// ==/UserScript==
let logPrefix = "Fix Squad -";
console.log(logPrefix+" INIT!");

let teamURL = "https://sokker.org/api/current";
let playerURL = "https://sokker.org/api/player/";//playerId
let squadURL = "https://sokker.org/api/player?filter[limit]=200&filter[offset]=0&filter[team]=";//teamId
let trainingURL = "https://sokker.org/api/training/players";
let playerTrainingInfoURL = "https://sokker.org/es/app/training/player-info/";//playerId
let teamIdXPath = "//span[text()='Team ID: ']"; //"//a[contains(text(),'Searching')]";

let limit = 50;
let waith = 500;

let incStamina = false;
let incForm = false;
let incKeeperMinVal = 5;

fetch(teamURL)
  .then(res1 => res1.json())
  .then(resData1 => {
    console.log(logPrefix+" teamID "+resData1.team.id);
    let teamId = resData1.team.id;
    let counter1 = 0;
    let intv1 = setInterval(async function() {
      counter1++;
      let teamIdElem = document.evaluate(teamIdXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if(teamIdElem == null){
        console.log(logPrefix+" BASE in "+(counter1*waith)+"ms try "+counter1+" NOT READY");
        if (counter1 >= limit) {
          console.log(logPrefix+" BASE in "+(counter1*waith)+"ms try "+counter1+" CANCELED!");
          clearInterval(intv1);
        }
        return false;
      }
      console.log(logPrefix+" BASE in "+(counter1*waith)+"ms try "+counter1+" READY!");
      clearInterval(intv1)
      let curTeamId = teamIdElem.nextElementSibling.textContent;
      console.log(logPrefix+" curTeamId:"+curTeamId);

      let counter2 = 0;
      let intv2 = setInterval(async function() {
        counter2++;
        let playersBoxElems = document.querySelectorAll(".player-box .player-box-header");
        if(playersBoxElems == null || playersBoxElems.length == 0){
          console.log(logPrefix+" PLAYERS in "+(counter2*waith)+"ms try "+counter2+" NOT READY");
          if (counter2 >= limit) {
            console.log(logPrefix+" PLAYERS in "+(counter2*waith)+"ms try "+counter2+" CANCELED!");
            clearInterval(intv2);
          }
          return false;
        }
        console.log(logPrefix+" in "+(counter2*waith)+"ms try "+counter2+" READY!");
        clearInterval(intv2)

        let trnTeamData;
        if (teamId == curTeamId) {
          await fetch(trainingURL)
            .then((response)=>response.json())
            .then((responseJson)=>{
              //console.log("trnData1 = "+JSON.stringify(responseJson));
              trnTeamData = responseJson
            });
          //console.log("trnTeamData: "+JSON.stringify(trnTeamData));
        }

        let playersCount = 0;
        let playersAgeSum = 0;
        let playersValSum = 0;
        let playersSalSum = 0;
        playersBoxElems.forEach(async playerBoxElem => {
          let playerRefName = playerBoxElem.querySelector(".player-box-header__name span.headline a").textContent;
          let playerRefURL = playerBoxElem.querySelector(".player-box-header__name span.headline a").getAttribute("href");
          let playerId = playerRefURL.substring(playerRefURL.lastIndexOf("/") + 1);
          //console.log(logPrefix+" playerId:"+playerId+" URL:"+playerURL+playerId);
          if (teamId == curTeamId) {
            let elBtn = document.createElement('div');
            elBtn.classList.add('player-box-header__extrainfo_link');
            elBtn.classList.add('ml-3');
            elBtn.innerHTML = '<span class="headline player-box-header-value player-box-header-value--has-columns-layout"><span class="headline fs-13 fs-15@>mobile fw-800 ls-15"><a target="_blank" href="'+playerTrainingInfoURL+playerId+'/"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-postcard-fill" viewBox="0 0 16 16"><path d="M11 8h2V6h-2v2Z"/>'+
                              '<path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm8.5.5a.5.5 0 0 0-1 0v7a.5.5 0 0 0 1 0v-7ZM2 5.5a.5.5 0 0 0 .5.5H6a.5.5 0 0 0 0-1H2.5a.5.5 0 0 0-.5.5ZM2.5 7a.5.5 0 0 0 0 1H6a.5.5 0 0 0 0-1H2.5ZM2 9.5a.5.5 0 0 0 .5.5H6a.5.5 0 0 0 0-1H2.5a.5.5 0 0 0-.5.5Zm8-4v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z"/></svg></a></span></span>';
            playerBoxElem.querySelector(".player-box-header__copy").after(elBtn);
          }
          await fetch(playerURL+playerId)
            .then(res2 => res2.json())
            .then(resData2 => {
              playersCount++;
              playersValSum += resData2.info.value.value;
              playersSalSum += resData2.info.wage.value;
              playersAgeSum += resData2.info.characteristics.age;

              let elVis = document.createElement('div');
              elVis.classList.add('player-box-header__extrainfo_vis');
              if (resData2.info.nationalSharing) elVis.innerHTML += '<span class="headline player-box-header-value player-box-header-value--has-columns-layout"><span class="headline fs-13 fs-15@>mobile fw-800 ls-15"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-fill" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg></span></span>';
              else elVis.innerHTML += '<span class="headline player-box-header-value player-box-header-value--has-columns-layout"><span class="headline fs-13 fs-15@>mobile fw-800 ls-15"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash-fill" viewBox="0 0 16 16"><path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/><path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/></svg></span></span>';
              playerBoxElem.querySelector(".player-box-header__salary").after(elVis);

              let trnInfo = resData2.info.formation.name;
              if (trnTeamData) {
                  trnTeamData.general.forEach(trnData => {
                      if (playerId == trnData.id) {
                          trnInfo += " - Gen "+trnData.effectiveness+"%";
                      }
                  });
                  trnTeamData.advanced.forEach(trnData => {
                      if (playerId == trnData.id) {
                          trnInfo += " - Adv "+trnData.effectiveness+"%";
                      }
                  });
              }

              let elTrn = document.createElement('div');
              elTrn.classList.add('player-box-header__extrainfo_pos');
              elTrn.innerHTML = '<span class="headline player-box-header-value player-box-header-value--has-columns-layout"><span class="headline">Trn:</span><span class="headline fs-13 fs-15@>mobile fw-800 ls-15">'+trnInfo+'</span></span>';
              playerBoxElem.querySelector(".player-box-header__salary").after(elTrn);

              let viewSkills = (resData2.info.skills.pace) ? true : false;

              if (viewSkills) {
                let totalSkills = 0;
                totalSkills += resData2.info.skills.playmaking;
                totalSkills += resData2.info.skills.passing;
                totalSkills += resData2.info.skills.technique;
                totalSkills += resData2.info.skills.defending;
                totalSkills += resData2.info.skills.striker;
                totalSkills += resData2.info.skills.pace;

                if (incStamina) totalSkills += resData2.info.skills.stamina;
                if (incForm) totalSkills += resData2.info.skills.form;
                if (resData2.info.skills.keeper > incKeeperMinVal) totalSkills += resData2.info.skills.keeper;

                console.log(logPrefix+" playerId:"+playerId+" skills:"+totalSkills+" trn:"+resData2.info.formation.name);

                let elSkls = document.createElement('div');
                elSkls.classList.add('player-box-header__extrainfo_skills');
                elSkls.innerHTML = '<span class="headline player-box-header-value player-box-header-value--has-columns-layout"><span class="headline">T.Skls:</span><span class="headline fs-13 fs-15@>mobile fw-800 ls-15">'+totalSkills+'</span></span>';
                playerBoxElem.querySelector(".player-box-header__salary").after(elSkls);
              }
              if (playersCount == playersBoxElems.length) {
                  let frmVal = function(val) {
                      let strVal = ""+parseInt(val);
                      let retVal = "";
                      let total = 0;
                      while (strVal.length > (total + 3)) {
                          total += 3;
                          retVal = "&nbsp;"+strVal.substr(total * -1) + retVal;
                      }
                      retVal = strVal.substr(0, strVal.length - total) + retVal;
                      return retVal;
                  }
                  let squadTitle = document.querySelectorAll(".view-squad-header");
                  let elAgeAvr = document.createElement('div');
                  elAgeAvr.classList.add('view-squad-header__plus');
                  elAgeAvr.innerHTML = '<span class="headline c-text-light fs-16 fs-18@>mobile fw-700">'+frmVal(playersValSum/playersCount)+' <small>'+resData2.info.wage.currency+' Val Av</small></span>'+
                      '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="headline c-text-light fs-16 fs-18@>mobile fw-700">'+frmVal(playersSalSum/playersCount)+' <small>'+resData2.info.wage.currency+' Sal Av</small></span>'+
                      '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="headline c-text-light fs-16 fs-18@>mobile fw-700">'+(playersAgeSum/playersCount).toFixed(2)+' <small>Age Av</small></span>';
                  console.log("playersCount:"+playersCount+" playersValSum:"+playersValSum+" elAgeAvr.innerHTML:"+ elAgeAvr.innerHTML);
                  squadTitle[0].querySelector(".view-squad-header__main").after(elAgeAvr);
              }
            })
            .catch(err => {
              throw err
            });

          });
      }, waith);

    }, waith);
  })
  .catch(err => {
      throw err
  });

/*
------------

General:
/api/current: general info. about the team

Training:
/api/training/formations: training type for every position
/api/training/players: players who get general/advanced training. Also effectiveness and intensity

------------

To be able to use the api I had to send a POST to:

https://sokker.org//api/auth/login

With a json string in the body:

requestSettings.setRequestBody("{\"login\" : \"" + login + "\", \"password\" : \"" + password + "\", \"remember\" : false }");

------

The players URL limits the result to 20 players by default. I had to add the filter[limit] parameter:

/api/player?filter[limit]=200&filter[offset]=0&filter[team]=

------

Beware that the api returns different data if you access directly to a player or to the team. At least the "info.formation" is only shown in the player

------

Differences found between XML and JSON apis:

- Values and wages are returned in the users currency
- Weight and BMI are decimal numbers now, but I found a case where weight was an Integer
- Advanced training is no longer found in the api. I had to access /api/training/players to read to whole team
- Neither player or club's page show if the player is member of a NT
- I found no way to know if a player has a transfer ad

*/
