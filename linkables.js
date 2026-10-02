/* Tigerès Logs — linkables page */

(function () {
  "use strict";

  var select = document.getElementById("platform-select");
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".link"));
  var emptyNote = document.getElementById("link-empty");
  var allOption = select.options[0];

  function refreshCount() {
    allOption.textContent = "All linkables — " + tiles.length + " on the shelf";
  }

  select.addEventListener("change", function () {
    var platform = select.value;
    var visible = 0;
    tiles.forEach(function (tile) {
      var show = platform === "all" || tile.dataset.platform === platform;
      tile.classList.toggle("hide", !show);
      if (show) visible++;
    });
    emptyNote.hidden = visible !== 0;
  });

  refreshCount();

  /* ---------- header balance ---------- */
  var key = localStorage.getItem("tigeres_key");
  if (key) {
    fetch("/api/deposits/" + encodeURIComponent(key))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (items) {
        if (!Array.isArray(items)) return;
        var balance = items
          .filter(function (d) {
            return d.status === "fulfilled";
          })
          .reduce(function (sum, d) {
            return sum + Number(d.usd_amount);
          }, 0);
        document.getElementById("balance-amount").textContent =
          "$" + balance.toFixed(2).replace(/\.00$/, "");
      })
      .catch(function () {});
  }

  document.getElementById("year").textContent = String(new Date().getFullYear());
})();
