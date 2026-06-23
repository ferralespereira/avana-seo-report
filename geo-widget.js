/*
 * geo-widget.js — renders the per-page GEO (Generative Engine Optimization)
 * scorecard from the daily competitor scan.
 *
 * Usage in a procedure page:
 *   <div class="geo-history" data-slug="brazilian-butt-lift-miami"></div>
 *   <script src="reports/keyword-history.js"></script>
 *   <script src="geo-widget.js"></script>
 *
 * Reads window.KEYWORD_HISTORY[slug].scans[date].geo (written by keyword_scan.py)
 * and builds a matrix: rows = the 8 GEO signals + composite score, columns =
 * the sites that ranked that day (ordered by GEO score, Avana highlighted).
 * These are the signals that make a page citable by AI answer engines
 * (Google AI Overviews, ChatGPT, Perplexity, Claude).
 */
(function () {
  var TEAL = "#0E7C7B", NAVY = "#1B3A5C", PURPLE = "#6d28d9";

  // signal key -> {label, tip, kind}. kind "count" = raw integer, "dens" = per-1k,
  // "bool" = yes/no, "score" = the composite.
  var ROWS = [
    { key: "score",    label: "GEO Score",   kind: "score", tip: "Weighted composite, higher = more citable by AI engines. Formula: 3×Stats/1k + 4×Citations + 3×Quotes + 1.5×Q&A + 1×Defs + 1×E-E-A-T + 0.5×Struct + 2×Fresh." },
    { key: "stats_1k", label: "Statistics",  kind: "dens",  tip: "Concrete liftable numbers ($, %, durations, sizes) per 1,000 words. The #1 GEO lever." },
    { key: "cites",    label: "Authority citations", kind: "count", tip: "Outbound links to authority sources (.gov/.edu, FDA, ASPS, Mayo…). What AI trusts and re-cites." },
    { key: "quotes",   label: "Quotations",  kind: "count", tip: "Blockquotes / attributed expert statements that get pulled into answers." },
    { key: "qa",       label: "Q&A (FAQs)",  kind: "count", tip: "Question-style headings — pre-chunked passages an engine can quote verbatim." },
    { key: "defs",     label: "Definitions", kind: "count", tip: "“X is a procedure that…” direct-answer phrasing AI surfaces." },
    { key: "auth",     label: "E-E-A-T signals", kind: "count", tip: "Credentials & named experts (board-certified, MD, FACS, Dr. names, pro orgs)." },
    { key: "struct",   label: "Structure",   kind: "count", tip: "Tables & list items — clean, extractable formats." },
    { key: "fresh",    label: "Freshness",   kind: "bool",  tip: "Recency signal (“updated / reviewed 20xx”)." }
  ];

  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function hasGeo(scan) {
    return scan && scan.geo && scan.geo.some(function (g) { return g; });
  }

  function render(container) {
    var slug = container.getAttribute("data-slug");
    var data = (window.KEYWORD_HISTORY || {})[slug];
    if (!data) {
      container.appendChild(el("div",
        "padding:16px;border:1px dashed #ccc;border-radius:8px;color:#999;font-size:13px;",
        "GEO scorecard will appear here after the next daily scan."));
      return;
    }

    // only days that actually carry geo data
    var dates = Object.keys(data.scans).filter(function (d) { return hasGeo(data.scans[d]); })
      .sort().reverse();
    if (!dates.length) {
      container.appendChild(el("div",
        "padding:16px;border:1px dashed #ccc;border-radius:8px;color:#999;font-size:13px;",
        "GEO scorecard will appear here after the next daily scan (no GEO data recorded yet)."));
      return;
    }

    // ── Card shell ──
    var card = el("div", "background:#fff;border-radius:8px;border:1px solid #ddd;overflow:hidden;margin:24px 0;");
    var header = el("div", "background:" + PURPLE + ";color:#fff;padding:14px 20px;");
    header.appendChild(el("div", "font-size:16px;font-weight:700;",
      "🤖 GEO Scorecard — " + (data.keyword || slug)));
    header.appendChild(el("div", "font-size:12px;color:#dcd6f5;margin-top:4px;",
      "How citable each ranking page is by AI answer engines (AI Overviews, ChatGPT, Perplexity, Claude). Higher = better."));

    var pick = el("div", "margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
    pick.appendChild(el("span", "font-size:12px;color:#dcd6f5;", "Scan date:"));
    var select = el("select",
      "font-size:13px;padding:4px 8px;border-radius:5px;border:1px solid #b59ae8;background:#fff;color:" + NAVY + ";font-weight:600;");
    dates.forEach(function (d, i) {
      var o = document.createElement("option");
      o.value = d; o.textContent = d + (i === 0 ? "  (latest)" : "");
      select.appendChild(o);
    });
    pick.appendChild(select);

    pick.appendChild(el("span", "font-size:12px;color:#dcd6f5;margin-left:6px;", "Compare to:"));
    var cmp = el("select",
      "font-size:13px;padding:4px 8px;border-radius:5px;border:1px solid #b59ae8;background:#fff;color:" + NAVY + ";font-weight:600;");
    pick.appendChild(cmp);

    pick.appendChild(el("span", "font-size:11px;color:#cdc4ee;", dates.length + " day(s) with GEO data"));
    header.appendChild(pick);
    card.appendChild(header);

    // populate "compare to" with earlier GEO days only (default = previous day)
    function fillCmp(primary) {
      cmp.innerHTML = "";
      var none = document.createElement("option");
      none.value = ""; none.textContent = "— none —";
      cmp.appendChild(none);
      var earlier = dates.filter(function (d) { return d < primary; });
      earlier.forEach(function (d, i) {
        var o = document.createElement("option");
        o.value = d; o.textContent = d + (i === 0 ? "  (prev. day)" : "");
        cmp.appendChild(o);
      });
      cmp.value = earlier.length ? earlier[0] : "";
    }

    var bodyWrap = el("div", "padding:8px 16px 16px;overflow-x:auto;");
    card.appendChild(bodyWrap);

    var legend = el("div",
      "padding:0 16px 14px;font-size:11px;color:#999;font-style:italic;display:flex;gap:18px;flex-wrap:wrap;align-items:center;");
    legend.innerHTML =
      '<span><span style="display:inline-block;width:32px;height:11px;background:linear-gradient(90deg,#f5f2fc,' + PURPLE + ');border-radius:2px;vertical-align:middle;border:1px solid #ddd;"></span> Darker = stronger signal</span>' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#fde8e8;border:1px solid #c0392b;border-radius:2px;vertical-align:middle;"></span> Gap — a competitor beats Avana on this signal</span>' +
      '<span style="color:#bbb;">Columns ranked by GEO score; Avana highlighted in purple. Hover a row label for what it measures.</span>';
    card.appendChild(legend);

    container.appendChild(card);

    function val(g, key) { return (g && g[key] != null) ? g[key] : 0; }

    function fmt(row, v) {
      if (row.kind === "bool") return v ? "yes" : "—";
      if (row.kind === "dens" || row.kind === "score") return (Math.round(v * 10) / 10).toString();
      return String(v);
    }

    // small delta chip: positive change is good for every GEO signal
    function delta(d, kind) {
      if (!d) return '<span style="color:#bbb;font-size:9px;"> ±0</span>';
      var up = d > 0;
      var mag = (kind === "dens" || kind === "score") ? Math.round(Math.abs(d) * 10) / 10 : Math.abs(d);
      return '<span style="font-size:9px;color:' + (up ? "#1E7E34" : "#c0392b") + ';"> ' +
        (up ? "▲" : "▼") + mag + '</span>';
    }

    // match a primary column to the comparison scan: by avana flag, else by domain
    function cmpValue(C, si, primarySite, key) {
      if (!C) return null;
      var cj = -1;
      if (primarySite.avana) {
        cj = C.sites.map(function (s) { return s.avana; }).indexOf(true);
      } else {
        for (var k = 0; k < C.sites.length; k++) {
          if (C.sites[k].domain === primarySite.domain) { cj = k; break; }
        }
      }
      if (cj < 0 || !C.geo[cj]) return null;
      // don't diff against point-in-time archives or unreachable captures
      if (C.sites[cj].archived || C.sites[cj].ok === false) return null;
      return val(C.geo[cj], key);
    }

    function draw(date, cmpDate) {
      bodyWrap.innerHTML = "";
      if (!hasGeo(data.scans[date])) date = dates[0];
      var scan = data.scans[date];
      var sites = scan.sites, geo = scan.geo;
      var C = (cmpDate && hasGeo(data.scans[cmpDate])) ? data.scans[cmpDate] : null;

      // order columns by GEO score desc; Avana index
      var order = sites.map(function (_, i) { return i; })
        .sort(function (a, b) { return val(geo[b], "score") - val(geo[a], "score"); });
      var avanaIdx = sites.map(function (s) { return s.avana; }).indexOf(true);
      var avanaRank = order.indexOf(avanaIdx) + 1;

      var table = el("table", "border-collapse:collapse;font-size:13px;width:100%;min-width:" + (200 + order.length * 64) + "px;");

      // header row
      var thead = el("thead");
      var hr = el("tr", "color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.4px;");
      hr.appendChild(el("th", "padding:10px 8px;border-bottom:2px solid #eee;text-align:left;position:sticky;left:0;background:#fff;", "GEO signal"));
      order.forEach(function (si, idx) {
        var s = sites[si], teal = s.avana;
        var border = s.avana ? ";border-left:2px solid " + PURPLE + ";border-right:2px solid " + PURPLE + ";" : "";
        var posTxt = s.pos ? "#" + s.pos : (s.avana ? "—" : "");
        var th = el("th",
          "padding:10px 6px;border-bottom:2px solid #eee;text-align:center;font-weight:" + (s.avana ? "800" : "700") +
          ";color:" + (teal ? PURPLE : "#555") + (s.ok === false ? ";opacity:.45" : "") + border);
        th.title = s.domain + (s.pos ? " — ranked #" + s.pos + " that day" : "");
        th.innerHTML = '<span style="display:block;font-size:9px;font-weight:400;color:#bbb;">SERP ' + (posTxt || "&nbsp;") + '</span>' +
          s.label +
          '<span style="display:block;font-size:9px;font-weight:400;color:' + (teal ? PURPLE : "#bbb") + ';">GEO #' + (idx + 1) + '</span>';
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);

      // body rows
      var tbody = el("tbody");
      ROWS.forEach(function (row) {
        var vals = order.map(function (si) { return val(geo[si], row.key); });
        var rowMax = Math.max.apply(null, vals.concat([row.kind === "bool" ? 1 : 0.0001]));
        var avanaVal = val(geo[avanaIdx], row.key);
        var compMax = Math.max.apply(null, order.filter(function (si) { return si !== avanaIdx; })
          .map(function (si) { return val(geo[si], row.key); }).concat([0]));
        var gap = avanaVal < compMax;     // a competitor beats us on this signal

        var isScore = row.kind === "score";
        var tr = el("tr", "border-bottom:1px solid #f0f0f0;" + (isScore ? "background:#faf8ff;" : ""));
        var tdK = el("td",
          "padding:8px;font-weight:" + (isScore ? "800" : "600") + ";color:" + NAVY +
          ";white-space:nowrap;position:sticky;left:0;cursor:help;background:" + (gap && !isScore ? "#fef5f5" : (isScore ? "#faf8ff" : "#fff")) + ";");
        tdK.title = row.tip;
        tdK.innerHTML = row.label +
          (gap && !isScore ? ' <span style="font-size:10px;font-weight:700;color:#c0392b;background:#fde8e8;border:1px solid #f5c6c6;border-radius:999px;padding:1px 7px;">gap</span>' : "");
        tr.appendChild(tdK);

        order.forEach(function (si) {
          var s = sites[si], v = val(geo[si], row.key);
          var border = s.avana ? ";border-left:2px solid " + PURPLE + ";border-right:2px solid " + PURPLE + ";" : "";
          if (geo[si] == null) {
            tr.appendChild(el("td", "padding:6px;text-align:center;color:#ccc;" + border, "&ndash;"));
            return;
          }
          var bg = "transparent", color = "#bbb", weight = "400";
          var norm = rowMax > 0 ? v / rowMax : 0;
          if (v > 0) {
            var alpha = 0.12 + norm * 0.78;
            bg = "rgba(109,40,217," + alpha.toFixed(2) + ")";
            color = norm > 0.55 ? "#fff" : NAVY;
            weight = isScore ? "800" : (norm > 0.45 ? "700" : "600");
          }
          var dHtml = "";
          if (C) {
            var cv = cmpValue(C, si, s, row.key);
            if (cv != null) dHtml = delta(v - cv, row.kind);
          }
          tr.appendChild(el("td",
            "padding:6px;text-align:center;font-variant-numeric:tabular-nums;background:" + bg +
            ";color:" + color + ";font-weight:" + weight + border,
            fmt(row, v) + dHtml));
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      bodyWrap.appendChild(table);

      var note = el("div", "margin-top:8px;font-size:11px;color:#888;",
        "Avana GEO rank on " + date + ": <strong style=\"color:" + PURPLE + "\">#" + avanaRank + " of " + sites.length + "</strong>. " +
        "Rows marked <span style=\"color:#c0392b;font-weight:700;\">gap</span> are where at least one ranking competitor out-signals Avana — the content to add to win AI citations." +
        (C ? ' Deltas (<span style="color:#1E7E34;font-weight:700;">▲</span>/<span style="color:#c0392b;font-weight:700;">▼</span>) compare each cell against <strong>' + cmpDate + '</strong>; up is always better.' : ''));
      bodyWrap.appendChild(note);

      var formula = el("div",
        "margin-top:6px;padding:8px 10px;background:#faf8ff;border:1px solid #ece6fb;border-radius:6px;font-size:11px;color:#666;line-height:1.7;");
      formula.innerHTML =
        '<strong style="color:' + PURPLE + ';">How GEO Score is calculated</strong> — a weighted sum of the rows above (higher = more citable by AI engines):<br>' +
        '<span style="font-variant-numeric:tabular-nums;">' +
        '<strong>3</strong>×Stats/1k + <strong>4</strong>×Citations + <strong>3</strong>×Quotes + <strong>1.5</strong>×Q&amp;A + ' +
        '<strong>1</strong>×Defs + <strong>1</strong>×E-E-A-T + <strong>0.5</strong>×Struct + <strong>2</strong>×Fresh' +
        '</span><br>' +
        '<span style="color:#999;">Citations, statistics and quotations carry the most weight — they are the strongest drivers of being cited in AI answers. ' +
        'Stats/1k is per 1,000 words, so a thin page can inflate it.</span>';
      bodyWrap.appendChild(formula);
    }

    function refresh() { draw(select.value, cmp.value || null); }
    select.addEventListener("change", function () { fillCmp(select.value); refresh(); });
    cmp.addEventListener("change", refresh);

    fillCmp(dates[0]);
    refresh();
  }

  function init() {
    var nodes = document.querySelectorAll(".geo-history");
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
