/*
 * kw-history-widget.js — renders the daily competitor keyword history table.
 *
 * Usage in a *-improvements.html page:
 *   <div class="kw-history" data-slug="brazilian-butt-lift-miami-improvements"></div>
 *   <script src="reports/keyword-history.js"></script>
 *   <script src="kw-history-widget.js"></script>
 *
 * Reads window.KEYWORD_HISTORY[slug], builds a date selector + a matrix where
 * columns are the sites that ranked that day (ordered by total keyword
 * strength, Avana highlighted) and rows are the page's fixed keyword set.
 */
(function () {
  var TEAL = "#0E7C7B", NAVY = "#1B3A5C";

  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function render(container) {
    var slug = container.getAttribute("data-slug");
    var data = (window.KEYWORD_HISTORY || {})[slug];
    if (!data) {
      container.appendChild(el("div",
        "padding:16px;border:1px dashed #ccc;border-radius:8px;color:#999;font-size:13px;",
        "Keyword history will appear here after the next daily scan."));
      return;
    }

    var dates = Object.keys(data.scans).sort().reverse(); // newest first
    var keywords = data.keywords;

    // ── Card shell ──
    var card = el("div", "background:#fff;border-radius:8px;border:1px solid #ddd;overflow:hidden;margin:24px 0;");
    var header = el("div", "background:" + NAVY + ";color:#fff;padding:14px 20px;");
    header.appendChild(el("div", "font-size:16px;font-weight:700;",
      "🔑 Competitor Keyword History &mdash; " + (data.keyword || slug)));
    var sub = el("div", "font-size:12px;color:#aac;margin-top:4px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;");
    sub.appendChild(el("span", null,
      "Daily scan of the sites ranking for this term. Pick a day to see who used which keywords."));
    header.appendChild(sub);

    // date selectors (primary + optional comparison)
    var pick = el("div", "margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
    pick.appendChild(el("span", "font-size:12px;color:#cdd;", "Scan date:"));
    var select = el("select",
      "font-size:13px;padding:4px 8px;border-radius:5px;border:1px solid #5a7;background:#fff;color:" + NAVY + ";font-weight:600;");
    dates.forEach(function (d, i) {
      var o = document.createElement("option");
      o.value = d; o.textContent = d + (i === 0 ? "  (latest)" : "");
      select.appendChild(o);
    });
    pick.appendChild(select);

    pick.appendChild(el("span", "font-size:12px;color:#cdd;margin-left:6px;", "Compare to:"));
    var cmp = el("select",
      "font-size:13px;padding:4px 8px;border-radius:5px;border:1px solid #5a7;background:#fff;color:" + NAVY + ";font-weight:600;");
    pick.appendChild(cmp);
    pick.appendChild(el("span", "font-size:11px;color:#9ab;", dates.length + " day(s) tracked"));
    header.appendChild(pick);
    card.appendChild(header);

    // populate the "compare to" options for a given primary date (earlier days only)
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
      // default to the previous day if one exists
      cmp.value = earlier.length ? earlier[0] : "";
    }

    var bodyWrap = el("div", "padding:8px 16px 16px;overflow-x:auto;");
    card.appendChild(bodyWrap);

    var legend = el("div",
      "padding:0 16px 14px;font-size:11px;color:#999;font-style:italic;display:flex;gap:18px;flex-wrap:wrap;align-items:center;");
    legend.innerHTML =
      '<span><span style="display:inline-block;width:32px;height:11px;background:linear-gradient(90deg,#f3f6f6,' + TEAL + ');border-radius:2px;vertical-align:middle;border:1px solid #ddd;"></span> Darker = more mentions</span>' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#fde8e8;border:1px solid #c0392b;border-radius:2px;vertical-align:middle;"></span> Gap — competitors use it, Avana doesn’t</span>' +
      '<span style="color:#bbb;">Columns ranked by total keyword strength; Avana highlighted in teal.</span>' +
      '<span style="color:#0E7C7B;font-weight:700;">&#9995; manual</span><span style="color:#bbb;margin-left:-12px;"> = saved-page copy</span>' +
      '<span style="color:#7F8C9B;font-weight:700;">&#8635; carried</span><span style="color:#bbb;margin-left:-12px;"> = last live count reused</span>' +
      '<span style="color:#E67E22;font-weight:700;">&#128229; archived</span><span style="color:#bbb;margin-left:-12px;"> = Wayback snapshot</span>';
    card.appendChild(legend);

    container.appendChild(card);

    // Build a lookup for a scan: site index by domain, by avana flag, totals, rank.
    function indexScan(scan) {
      var sites = scan.sites, counts = scan.counts;
      var totals = sites.map(function (_, si) {
        return counts.reduce(function (s, row) { return s + (row[si] || 0); }, 0);
      });
      var order = sites.map(function (_, i) { return i; })
        .sort(function (a, b) { return totals[b] - totals[a]; });
      var rankOf = {};            // site index -> strength rank (1-based)
      order.forEach(function (si, idx) { rankOf[si] = idx + 1; });
      var byDomain = {}, domCount = {}, avanaIdx = -1;
      sites.forEach(function (s, i) {
        byDomain[s.domain] = i;
        domCount[s.domain] = (domCount[s.domain] || 0) + 1;
        if (s.avana) avanaIdx = i;
      });
      return { sites: sites, counts: counts, totals: totals, order: order,
               rankOf: rankOf, byDomain: byDomain, domCount: domCount, avanaIdx: avanaIdx };
    }

    // Resolve a primary-scan column against the comparison scan.
    // Returns {cj, status}: status = "match" | "new" | "skip" (ambiguous domain).
    function resolve(P, C, si) {
      var s = P.sites[si], cj;
      if (s.avana) {
        cj = C.avanaIdx;
        if (cj === -1) return { cj: -1, status: "new" };
      } else {
        if (P.domCount[s.domain] > 1) return { cj: -1, status: "skip" };   // dup domain this day
        if (!(s.domain in C.byDomain)) return { cj: -1, status: "new" };
        if (C.domCount[s.domain] > 1) return { cj: -1, status: "skip" };   // dup domain other day
        cj = C.byDomain[s.domain];
      }
      // can't compare unreachable or archived (point-in-time) captures
      if (s.ok === false || s.archived || C.sites[cj].ok === false || C.sites[cj].archived)
        return { cj: cj, status: "skip" };
      return { cj: cj, status: "match" };
    }

    // origin badge under a column header — shows where its counts came from
    function sourceBadge(s) {
      var src = s.source || (s.archived ? "wayback" : (s.ok === false ? "none" : "live"));
      if (src === "wayback")
        return '<span style="display:block;font-size:8px;font-weight:700;color:#E67E22;" title="Live page blocked — counts from a Wayback Machine archive">&#128229; archived ' + (s.archived || "") + '</span>';
      if (src === "carried")
        return '<span style="display:block;font-size:8px;font-weight:700;color:#7F8C9B;" title="Live page blocked — reusing last live count">&#8635; carried ' + (s.carried_from || "") + '</span>';
      if (src === "manual")
        return '<span style="display:block;font-size:8px;font-weight:700;color:#0E7C7B;" title="Counted from a manually-saved copy of the page">&#9995; manual ' + (s.manual_date || "") + '</span>';
      return "";  // live (and none) get no badge
    }

    // small delta chip: positive = increase
    function delta(d) {
      if (d === 0) return '<span style="color:#bbb;font-size:9px;"> ±0</span>';
      var up = d > 0;
      return '<span style="font-size:9px;color:' + (up ? "#1E7E34" : "#c0392b") + ';"> ' +
        (up ? "▲" : "▼") + Math.abs(d) + '</span>';
    }

    function draw(date, cmpDate) {
      bodyWrap.innerHTML = "";
      if (!data.scans[date]) date = dates[0];           // safety fallback
      var P = indexScan(data.scans[date]);
      var C = cmpDate && data.scans[cmpDate] ? indexScan(data.scans[cmpDate]) : null;
      var sites = P.sites, counts = P.counts, order = P.order;
      var avanaRank = P.rankOf[P.avanaIdx];

      var table = el("table", "border-collapse:collapse;font-size:13px;width:100%;min-width:" + (220 + order.length * 60) + "px;");
      var thead = el("thead");
      var hr = el("tr", "color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.4px;");
      hr.appendChild(el("th", "padding:10px 8px;border-bottom:2px solid #eee;text-align:left;position:sticky;left:0;background:#fff;", "Keyword"));
      order.forEach(function (si, idx) {
        var s = sites[si];
        var teal = s.avana;
        var border = s.avana ? ";border-left:2px solid " + TEAL + ";border-right:2px solid " + TEAL + ";" : "";
        var posTxt = s.pos ? "#" + s.pos : (s.avana ? "—" : "");

        // movement vs comparison day
        var moveHtml = "", isNew = false;
        if (C) {
          var r = resolve(P, C, si);
          var cj = r.cj;
          if (r.status === "new") { isNew = true; }
          else if (r.status === "match") {
            var cs = C.sites[cj];
            // SERP position movement (lower is better)
            if (s.pos && cs.pos && s.pos !== cs.pos) {
              var pd = cs.pos - s.pos; // positive = moved up
              moveHtml += '<span style="font-size:9px;color:' + (pd > 0 ? "#1E7E34" : "#c0392b") + ';">' +
                (pd > 0 ? "▲" : "▼") + Math.abs(pd) + ' pos</span> ';
            }
            // strength-rank movement
            var rd = C.rankOf[cj] - P.rankOf[si]; // positive = stronger rank now
            if (rd !== 0) {
              moveHtml += '<span style="font-size:9px;color:' + (rd > 0 ? "#1E7E34" : "#c0392b") + ';">' +
                (rd > 0 ? "▲" : "▼") + Math.abs(rd) + ' str</span>';
            }
          }
        }

        var th = el("th",
          "padding:10px 6px;border-bottom:2px solid #eee;text-align:center;font-weight:" + (s.avana ? "800" : "700") +
          ";color:" + (teal ? TEAL : "#555") + (s.ok === false ? ";opacity:.45" : "") + border);
        th.title = s.domain + (s.pos ? " — ranked #" + s.pos + " that day" : "") +
          " — " + P.totals[si] + " total mentions" +
          (s.ok === false ? " (page unreachable)" : "") +
          (s.source === "manual" ? " (from a manually-saved page copy)" : "") +
          (s.source === "carried" ? " (live blocked — last live count from " + (s.carried_from || "") + ")" : "") +
          (s.archived ? " (from Wayback Machine archive, crawled " + s.archived + ")" : "");
        th.innerHTML = '<span style="display:block;font-size:9px;font-weight:400;color:#bbb;">SERP ' + (posTxt || "&nbsp;") + '</span>' +
          s.label +
          '<span style="display:block;font-size:9px;font-weight:400;color:' + (teal ? TEAL : "#bbb") + ';">strength #' + (idx + 1) + '</span>' +
          sourceBadge(s) +
          (isNew ? '<span style="display:block;font-size:8px;font-weight:700;color:#0E7C7B;">NEW</span>'
                 : (moveHtml ? '<span style="display:block;">' + moveHtml + '</span>' : ''));
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);

      var tbody = el("tbody");
      keywords.forEach(function (kw, ki) {
        var row = counts[ki];
        var gap = row[P.avanaIdx] === 0;
        var rowMax = Math.max.apply(null, row.filter(function (x) { return x != null; }).concat([1]));

        var tr = el("tr", "border-bottom:1px solid #f0f0f0;");
        var tdK = el("td",
          "padding:8px;font-weight:600;color:" + NAVY + ";white-space:nowrap;position:sticky;left:0;background:" + (gap ? "#fef5f5" : "#fff") + ";",
          kw + (gap ? ' <span style="font-size:10px;font-weight:700;color:#c0392b;background:#fde8e8;border:1px solid #f5c6c6;border-radius:999px;padding:1px 7px;">gap</span>' : ""));
        tr.appendChild(tdK);

        order.forEach(function (si) {
          var s = sites[si], v = row[si];
          var border = s.avana ? ";border-left:2px solid " + TEAL + ";border-right:2px solid " + TEAL + ";" : "";
          if (v == null) {                              // no data recovered for this cell
            tr.appendChild(el("td",
              "padding:6px;text-align:center;color:#ccc;" + border, "&ndash;"));
            return;
          }
          var bg = "transparent", color = "#bbb", weight = "400";
          if (v > 0) {
            var t = v / rowMax, alpha = 0.12 + t * 0.78;
            bg = "rgba(14,124,123," + alpha.toFixed(2) + ")";
            color = t > 0.55 ? "#fff" : NAVY;
            weight = t > 0.45 ? "700" : "600";
          }
          var dHtml = "";
          if (C) {
            var r = resolve(P, C, si);
            if (r.status === "match" && C.counts[ki][r.cj] != null) dHtml = delta(v - C.counts[ki][r.cj]);
          }
          tr.appendChild(el("td",
            "padding:6px;text-align:center;font-variant-numeric:tabular-nums;background:" + bg + ";color:" + color + ";font-weight:" + weight + border,
            String(v) + dHtml));
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      bodyWrap.appendChild(table);

      var note = el("div", "margin-top:8px;font-size:11px;color:#888;",
        "Avana keyword-strength rank on " + date + ": <strong style=\"color:" + TEAL + "\">#" + avanaRank + " of " + sites.length + "</strong>." +
        (C ? ' Deltas (▲/▼) compare against <strong>' + cmpDate + '</strong> &mdash; per cell: mention change; in headers: SERP &amp; strength-rank movement. <span style="color:#0E7C7B;font-weight:700;">NEW</span> = not ranking on the comparison day.' : ''));
      bodyWrap.appendChild(note);
    }

    function refresh() { draw(select.value, cmp.value || null); }
    select.addEventListener("change", function () { fillCmp(select.value); refresh(); });
    cmp.addEventListener("change", refresh);

    fillCmp(dates[0]);
    refresh();
  }

  function init() {
    var nodes = document.querySelectorAll(".kw-history");
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
