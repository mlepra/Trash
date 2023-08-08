// ==UserScript==
// @author tenuco
// @name Sokker Juniors Talent Calc
// @description Sokker Juniors Talent Calc Info
// @namespace sokker.org
// @match https://sokker.org/juniors/*
// @version 1.1.2
// @grant none
// @require https://cdnjs.cloudflare.com/ajax/libs/regression/2.0.1/regression.min.js
// ==/UserScript==
let tables = document.getElementsByClassName('table');
for (let t = 0; t < tables.length; t++) {
  for (let r = 0; r < tables[t].rows.length; r++) {
    let row = tables[t].rows[r];
    if (row.id.startsWith('juniorRow')) {
      let juniorId = row.id.substr('juniorRow'.length);
      let juniorName = row.cells[0].innerText;
      //console.log("Table row:"+r+" id:"+row.id+" juniorId:"+juniorId+" name:"+juniorName);
      //https://sokker.org/api/junior/27686135/graph
      fetch("https://sokker.org/api/junior/" + juniorId + "/graph")
        .then(res => res.json())
        .then(resData => {
          //if (resData.values.length >= 5) {
          //console.log(juniorName+' DATA:', resData.values);
          let weeks;
          let age = parseInt(row.cells[1].innerText, 10);
          let count = 0;
          let dataG = [];
          let data = [];
          resData.values.forEach(entry => {
              //console.log(count, entry.y);
              data.push([count, entry.y]);
              dataG.push(entry.y);
              count++;
          });
          //console.log(juniorName+' DATA:'+JSON.stringify(data));
          let talent;
          let spected;
          let weeksTotal;

          let elemStyle = "float: left;";

          let elemDst;

          if (row.cells.length == 6) {
              elemDst = row.cells[5].children[0];
              weeks = parseInt(row.cells[4].innerText, 10);
              weeksTotal = weeks + count;
          } else
          if (row.cells.length == 5) {
              elemDst = row.cells[4].children[0];
              weeks = count;
              weeksTotal = weeks;
              elemStyle += "margin-left: 24%;"
          } else {
              return;
          }

          if (count > 5) {
              let dataFixed = regression.linear(data);
              talent = Math.round((10 / (dataFixed.equation[0] * 10)) * 100) / 100;
              spected = dataFixed.predict(weeksTotal)[1]
          } else {
              talent = '--';
              spected = '--';
          }

          //console.log(juniorName+' talent:'+talent+' spected:'+spected+' tw:'+(count+weeks)+' dw:'+count+' rw:'+weeks+' eq:'+JSON.stringify(dataFixed.equation));
          //console.log('D:'+JSON.stringify(data));
          //console.log('F:'+JSON.stringify(dataFixed.points));
          //console.log('G:'+JSON.stringify(dataG));
          //console.log('dst:'+row.cells[5].children[0].innerHTML);
          //console.log('---------------------------------');
          let elem = document.createElement("li");
          elem.className = "talent_fix";
          elem.style.cssText = elemStyle;
          elem.innerHTML = '<button class="btn btn-primary btn-xs geston_evt"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-graph-up" viewBox="0 0 16 16">'+
                              '<path fill-rule="evenodd" d="M0 0h1v15h15v1H0V0Zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07Z"/>'+
                              '</svg></button> T: ' + talent + ' W: '+count+'/'+weeksTotal + ' P: ' + spected;
          elemDst.prepend(elem);
          let gestonURL = 'https://geston.smallhost.pl/sokker/juniors.html?pops=' + dataG.map((e) => (e)).join(',') + '&name=' + juniorName + '&age=' + age + '&weeks=' + weeks;

          let elemBtn = elem.querySelector("#" + row.id + " .geston_evt");
          elemBtn.addEventListener('click', () => {
              let elemChart = document.getElementById("juniorGestonGraphRow" + juniorId);
              if (elemChart) {
                  if (elemChart.style.display == 'none') {
                      elemChart.style.display = '';
                  } else {
                      elemChart.style.display = 'none';
                  }
              } else {
                  let elemTr = document.createElement("tr");
                  elemTr.id = 'juniorGestonGraphRow' + juniorId;
                  elemTr.innerHTML = '<td colspan="6"><iframe src="' + gestonURL + '" style="width:100%; height: 600px;" id="juniorGestonGraph' + juniorId + '" frameborder="0"></iframe></td>';
                  document.getElementById('juniorRow' + juniorId).after(elemTr);
              }
          });
        })
        .catch(err => {
          throw err
        });
    }
  }
}
