// ==UserScript==
// @name         Sokker Juniors Talent Calc
// @description  Sokker Juniors Talent Calc Info - funciona en la UI vieja (sokker.org) y en la nueva (app.sokker.org)
// @author       tenuco (adaptado: UI vieja + nueva)
// @namespace    sokker.org
// @match        https://sokker.org/juniors/*
// @match        https://sokker.org/juniors
// @match        https://app.sokker.org/*
// @updateURL    https://github.com/mlepra/Trash/raw/refs/heads/main/sk/juniors.user.js
// @downloadURL  https://github.com/mlepra/Trash/raw/refs/heads/main/sk/juniors.user.js
// @version      3.0.1
// @grant        GM_xmlhttpRequest
// @connect      sokker.org
// @require      https://cdnjs.cloudflare.com/ajax/libs/regression/2.0.1/regression.min.js

// ==/UserScript==

(function () {
  'use strict';

  const API = 'https://sokker.org/api/junior/';
  const WEEKS_PER_SEASON = 13; // la edad sube en la semana 1 de cada temporada
  const DEBUG = false;         // poner en true para ver logs en la consola
  const log = (...a) => DEBUG && console.log('[TalentCalc]', ...a);

  // ---------- Acceso a la API (con fallback si CORS bloquea fetch) ----------
  function getJson(url) {
    return fetch(url, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(err => {
        log('fetch falló, uso GM_xmlhttpRequest', err);
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'json',
            onload: r => {
              if (r.status >= 200 && r.status < 300) {
                resolve(r.response || JSON.parse(r.responseText));
              } else {
                reject(new Error('HTTP ' + r.status));
              }
            },
            onerror: reject
          });
        });
      });
  }

  // Cache: un solo request por junior aunque la UI re-renderice la tabla
  const graphCache = new Map();
  function getGraph(id) {
    if (!graphCache.has(id)) {
      const p = getJson(API + id + '/graph');
      p.catch(() => graphCache.delete(id)); // permitir reintento
      graphCache.set(id, p);
    }
    return graphCache.get(id);
  }

  // ---------- Semana actual de la temporada ----------
  // UI vieja: <div class="clock-season">season 79 / week 7</div>
  // UI nueva: texto equivalente en el panel lateral.
  // Se busca "palabra + nº temporada + / + palabra + nº semana", sin depender del idioma.
  const SEASON_RE = /^\s*\S+\s+(\d{2,3})\s*\/\s*[^\d\s]+\s+(\d{1,2})\s*$/;
  function parseSeasonWeek(text) {
    const m = SEASON_RE.exec((text || '').replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const w = parseInt(m[2], 10);
    return (w >= 1 && w <= WEEKS_PER_SEASON) ? w : null;
  }
  function getSeasonWeek() {
    const known = document.querySelector('.clock-season');
    if (known) {
      const w = parseSeasonWeek(known.textContent);
      if (w != null) return w;
    }
    for (const el of document.querySelectorAll('div, span, p')) {
      if (el.children.length) continue;
      if (el.textContent.length > 80) continue;
      const w = parseSeasonWeek(el.textContent);
      if (w != null) return w;
    }
    return null;
  }

  // Edad con la que sale de la academia: suma 1 por cada "semana 1" que cruce.
  function expectedAge(age, seasonWeek, weeksLeft) {
    if (seasonWeek == null || isNaN(age) || isNaN(weeksLeft)) return null;
    return age + Math.floor((seasonWeek + weeksLeft - 1) / WEEKS_PER_SEASON);
  }

  // ---------- Adaptadores de UI ----------
  // Cada adaptador devuelve, para una fila: id, nombre, edad, semanas que le quedan
  // y el contenedor donde inyectar. Así el resto del script es común.
  const num = s => parseInt((s || '').trim(), 10);

  const UI_NEW = {
    name: 'new',
    rowSelector: 'table.table__root tbody tr[data-row-id]',
    read(row) {
      const id = row.getAttribute('data-row-id');
      const dst = row.querySelector('td.table__cell--actions .table__cell-wrap');
      if (!id || !dst) return null;
      const cellText = n => {
        const td = row.querySelector('td.table__cell--' + n);
        return td ? td.textContent : null;
      };
      // la UI nueva trae dos spans: nombre corto (mobile:hidden) y nombre completo
      const btn = row.querySelector('td.table__cell--surname button');
      let name = '';
      if (btn) {
        const leaves = [...btn.querySelectorAll('span')]
          .filter(s => s.children.length === 0)
          .map(s => s.textContent.trim())
          .filter(Boolean);
        name = leaves[leaves.length - 1] || btn.textContent.trim();
      }
      return {
        id, name, dst,
        age: num(cellText('age')),
        weeksLeft: num(cellText('weeksLeft'))
      };
    },
    mount(info, elem) {
      info.dst.classList.add('talent_wrap');
      info.dst.prepend(elem);
    },
    btnClass: 'geston_evt'
  };

  const UI_OLD = {
    name: 'old',
    rowSelector: 'table.table tr[id^="juniorRow"]',
    read(row) {
      const id = row.id.substring('juniorRow'.length);
      const c = row.cells;
      if (!id || c.length < 5) return null;
      const dst = c[c.length - 1];
      if (!dst) return null;
      return {
        id, dst,
        name: c[0].textContent.trim(),
        age: num(c[1].textContent),
        // con 6 celdas la columna "Semanas" es lo que le queda; con 5 no existe
        weeksLeft: c.length === 6 ? num(c[4].textContent) : NaN
      };
    },
    mount(info, elem) {
      elem.classList.add('tc_old');
      info.dst.prepend(elem);
    },
    btnClass: 'btn btn-primary btn-xs geston_evt'
  };

  const adapterFor = row =>
    row.hasAttribute('data-row-id') ? UI_NEW :
    (row.id && row.id.startsWith('juniorRow')) ? UI_OLD : null;

  // ---------- Estilos ----------
  const style = document.createElement('style');
  style.textContent = `
    .talent_fix { display: inline-grid; align-items: center; text-align: left;
                  grid-template-columns: auto 6ch 8ch 7ch 6.5ch; column-gap: 0.5rem;
                  font-variant-numeric: tabular-nums; white-space: nowrap; }
    .talent_fix .tc_lbl { opacity: .65; margin-right: .3em; }
    .talent_fix .tc_up  { font-weight: 700; }

    /* UI nueva: info a la izquierda, botón Dismiss a la derecha */
    .talent_wrap { justify-content: space-between !important; gap: 1.6rem; }
    .talent_wrap .talent_fix { font-size: 1.2rem; color: var(--c-fg, inherit); }
    .talent_wrap .talent_fix .geston_evt { display: inline-flex; align-items: center; justify-content: center;
                  cursor: pointer; border: 1px solid var(--c-line, #888); border-radius: .4rem;
                  background: var(--c-surface-highlighted, transparent); color: inherit; padding: .2rem .5rem; }
    .talent_wrap .talent_fix .geston_evt:hover { filter: brightness(1.3); }

    /* UI vieja: info flotando a la izquierda, "Rechazar" queda a la derecha */
    .talent_fix.tc_old { float: left; }
  `;
  document.head.appendChild(style);

  const SVG_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">' +
    '<path fill-rule="evenodd" d="M0 0h1v15h15v1H0V0Zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07Z"/>' +
    '</svg>';

  // Pinta la edad esperada (al inyectar y de nuevo si la semana aparece después)
  function paintAge(elem) {
    const span = elem.querySelector('.tc_age');
    if (!span) return;
    const age = parseInt(elem.dataset.age, 10);
    const left = parseInt(elem.dataset.left, 10);
    const exp = expectedAge(age, getSeasonWeek(), left);
    if (exp == null) {
      span.innerHTML = '<span class="tc_lbl">Sale:</span>--';
      return;
    }
    span.innerHTML = '<span class="tc_lbl">E:</span>' +
      (exp > age ? '<span class="tc_up">' + exp + ' ▲</span>' : String(exp));
    span.title = 'Edad con la que sale de la academia (actual: ' + age + ')';
    elem.dataset.ageDone = '1';
  }

  // ---------- Inyección por fila ----------
  function processRow(row) {
    const ui = adapterFor(row);
    if (!ui) return;
    if (row.querySelector('.talent_fix')) return;      // ya inyectado
    if (row.dataset.talentPending === '1') return;     // request en curso
    const info = ui.read(row);
    if (!info) return;

    row.dataset.talentPending = '1';

    getGraph(info.id)
      .then(resData => {
        row.dataset.talentPending = '0';
        if (!row.isConnected || row.querySelector('.talent_fix')) return;

        const values = (resData && resData.values) || [];
        const data = [];
        const dataG = [];
        values.forEach((entry, i) => {
          data.push([i, entry.y]);
          dataG.push(entry.y);
        });
        const count = values.length;

        let weeks, weeksTotal;
        if (!isNaN(info.weeksLeft)) {
          weeks = info.weeksLeft;
          weeksTotal = weeks + count;
        } else {
          weeks = count;
          weeksTotal = count;
        }

        let talent = '--';
        let spected = '--';
        if (count > 5) {
          const fit = regression.linear(data);
          // si la pendiente es <= 0 (no sube) el talento no es calculable
          if (fit.equation[0] > 0) {
            talent = Math.round((10 / (fit.equation[0] * 10)) * 100) / 100;
            spected = fit.predict(weeksTotal)[1];
          }
        }

        const elem = document.createElement('span');
        elem.className = 'talent_fix';
        elem.dataset.age = isNaN(info.age) ? '' : info.age;
        elem.dataset.left = isNaN(info.weeksLeft) ? '' : info.weeksLeft;
        elem.innerHTML =
          '<button type="button" class="' + ui.btnClass + '" title="Ver gráfico">' + SVG_ICON + '</button>' +
          '<span title="Talento: semanas por punto de skill (menor = mejor)"><span class="tc_lbl">T:</span>' + talent + '</span>' +
          '<span title="Semanas con datos / semanas totales en la academia"><span class="tc_lbl">S:</span>' + count + '/' + weeksTotal + '</span>' +
          '<span title="Skill esperada al salir de la academia"><span class="tc_lbl">P:</span>' + spected + '</span>' +
          '<span class="tc_age"></span>';
        ui.mount(info, elem);
        paintAge(elem);

        const gestonURL =
          'https://geston.smallhost.pl/sokker/juniors.html?pops=' + dataG.join(',') +
          '&name=' + encodeURIComponent(info.name) +
          '&age=' + info.age +
          '&weeks=' + weeks;

        elem.querySelector('.geston_evt').addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation(); // en la UI nueva la fila entera es clickeable
          toggleChart(row, info.id, gestonURL);
        });

        // si el gráfico estaba abierto antes de un re-render, restaurarlo
        if (openCharts.has(info.id)) toggleChart(row, info.id, gestonURL, true);
      })
      .catch(err => {
        row.dataset.talentPending = '0';
        console.warn('[TalentCalc] No se pudo obtener el gráfico de', info.id, err);
      });
  }

  // ---------- Gráfico (iframe geston) ----------
  const openCharts = new Set();

  function toggleChart(row, id, url, forceOpen) {
    let tr = document.getElementById('juniorGestonGraphRow' + id);
    if (tr && !forceOpen) {
      const hidden = tr.style.display === 'none';
      tr.style.display = hidden ? '' : 'none';
      hidden ? openCharts.add(id) : openCharts.delete(id);
      return;
    }
    if (!tr) {
      const cols = row.cells.length;
      tr = document.createElement('tr');
      tr.id = 'juniorGestonGraphRow' + id;
      tr.innerHTML =
        '<td colspan="' + cols + '"><iframe src="' + url +
        '" style="width:100%;height:500px;border:0;" frameborder="0"></iframe></td>';
    }
    tr.style.display = '';
    row.after(tr);
    openCharts.add(id);
  }

  // ---------- Observador (ambas UIs cargan / re-renderizan de forma asíncrona) ----------
  const ROW_SELECTOR = UI_NEW.rowSelector + ', ' + UI_OLD.rowSelector;
  const rowOf = id =>
    document.querySelector('tr[data-row-id="' + id + '"]') || document.getElementById('juniorRow' + id);

  let scheduled = false;
  function scan() {
    scheduled = false;
    document.querySelectorAll(ROW_SELECTOR).forEach(processRow);
    // si la semana actual todavía no estaba en el DOM al inyectar, completar la edad
    document.querySelectorAll('.talent_fix:not([data-age-done])').forEach(paintAge);
    // reubicar gráficos abiertos si la tabla se reordenó
    openCharts.forEach(id => {
      const tr = document.getElementById('juniorGestonGraphRow' + id);
      const row = rowOf(id);
      if (tr && row && row.nextElementSibling !== tr) row.after(tr);
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(scan, 150);
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  scan();
})();
