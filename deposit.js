/* Tigerès Logs — deposit page logic (plain JS, no build step) */

(function () {
  "use strict";

  var KEY_API = "/api/session";
  var RATES_API = "/api/rates";
  var DEPOSIT_API = "/api/deposit";

  var COIN_TICK = { sol: "SOL", eth: "ETH", btc: "BTC" };
  var FALLBACK_RATES = { sol: 152.4, eth: 3180.55, btc: 68420.1 };

  var state = { usd: null, coin: null, rates: {} };

  function $(id) {
    return document.getElementById(id);
  }

  function fmtUsd(n) {
    return "$" + n.toFixed(2);
  }

  function coinDigits(coin) {
    return coin === "btc" ? 6 : 3;
  }

  function fmtCoin(n, coin) {
    return n.toFixed(coinDigits(coin)) + " " + COIN_TICK[coin];
  }

  /* ---------- session key (drives balance identity) ---------- */
  function getSessionKey() {
    var cached = localStorage.getItem("tigeres_key");
    if (cached) return Promise.resolve(cached);
    return fetch(KEY_API)
      .then(function (res) {
        if (!res.ok) throw new Error("session failed");
        return res.json();
      })
      .then(function (data) {
        localStorage.setItem("tigeres_key", data.key);
        return data.key;
      });
  }

  /* ---------- rates ---------- */
  function loadRates() {
    return fetch(RATES_API)
      .then(function (res) {
        if (!res.ok) throw new Error("rates failed");
        return res.json();
      })
      .catch(function () {
        return FALLBACK_RATES;
      })
      .then(function (rates) {
        state.rates = rates;
      });
  }

  /* ---------- amount selection ---------- */
  var presetButtons = Array.prototype.slice.call(document.querySelectorAll(".preset"));
  var customWrap = $("custom-wrap");
  var customInput = $("custom-usd");
  var customHint = $("custom-hint");

  function clearPresets() {
    presetButtons.forEach(function (b) {
      b.classList.remove("is-active");
    });
  }

  function setUsd(amount) {
    state.usd = amount;
    updateQuote();
  }

  presetButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      clearPresets();
      btn.classList.add("is-active");
      if (btn.id === "preset-custom") {
        customWrap.hidden = false;
        customInput.focus();
        var v = Number(customInput.value);
        setUsd(v >= 10 && v <= 10000 ? v : null);
      } else {
        customWrap.hidden = true;
        customInput.value = "";
        setUsd(Number(btn.dataset.usd));
      }
    });
  });

  customInput.addEventListener("input", function () {
    var v = Number(customInput.value);
    var valid = customInput.value !== "" && Number.isFinite(v) && v >= 10 && v <= 10000;
    customHint.textContent =
      customInput.value === "" ? "Between $10 and $10,000." : valid ? "" : "Amount must be between $10 and $10,000.";
    setUsd(valid ? v : null);
  });

  /* ---------- coin selection ---------- */
  var coinCards = Array.prototype.slice.call(document.querySelectorAll(".coin-card"));
  var addressLoaded = false;

  coinCards.forEach(function (card) {
    card.addEventListener("click", function () {
      coinCards.forEach(function (c) {
        c.classList.remove("is-active");
      });
      card.classList.add("is-active");
      state.coin = card.dataset.coin;
      loadAddress();
      updateQuote();
    });
  });

  function loadAddress() {
    if (!state.coin) return;
    fetch("/api/address/" + state.coin)
      .then(function (res) {
        if (!res.ok) throw new Error("address failed");
        return res.json();
      })
      .then(function (data) {
        $("pay-address").textContent = data.address;
        addressLoaded = true;
        renderQr();
      })
      .catch(function () {
        $("pay-address").textContent = "—";
      });
  }

  /* ---------- quote display ---------- */
  function updateQuote() {
    var step = $("quote-step");
    if (state.usd === null || !state.coin || !state.rates[state.coin]) {
      step.hidden = true;
      return;
    }
    step.hidden = false;
    var rate = state.rates[state.coin];
    var coinAmount = state.usd / rate;
    $("quote-usd").textContent = fmtUsd(state.usd);
    $("quote-tick").textContent = COIN_TICK[state.coin];
    $("quote-coin").textContent = coinAmount.toFixed(coinDigits(state.coin));
    $("quote-rate").textContent = "1 " + COIN_TICK[state.coin] + " = " + fmtUsd(rate);
    $("rule-coin").textContent = COIN_TICK[state.coin];
  }

  /* ---------- deposit submission ---------- */
  var confirmBtn = $("confirm-sent");

  confirmBtn.addEventListener("click", function () {
    if (state.usd === null || !state.coin) return;
    confirmBtn.disabled = true;
    var original = confirmBtn.textContent;
    confirmBtn.textContent = "Recording…";
    getSessionKey()
      .then(function (key) {
        return fetch(DEPOSIT_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usd: state.usd, coin: state.coin, key: key }),
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Deposit failed — try again.");
          return data;
        });
      })
      .then(function (data) {
        showConfirmation(data);
        return loadHistory();
      })
      .catch(function (err) {
        var errorBox = $("dep-error");
        errorBox.textContent = (err && err.message) || "Something went wrong — try again.";
        errorBox.hidden = false;
      })
      .finally(function () {
        confirmBtn.disabled = false;
        confirmBtn.textContent = original;
      });
  });

  function showConfirmation(data) {
    $("dep-config").hidden = true;
    $("dep-status-panel").hidden = false;
    $("final-usd").textContent = fmtUsd(Number(data.usd));
    $("final-coin-amount").textContent = fmtCoin(Number(data.coinAmount), data.coin);
    $("final-status").textContent = "NOT FULFILLED";
    $("final-status").className = "status-badge pending";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("another-deposit").addEventListener("click", function () {
    $("dep-status-panel").hidden = true;
    $("dep-config").hidden = false;
    $("dep-error").hidden = true;
  });

  /* ---------- QR code (address rendered locally) ---------- */
  function renderQr() {
    if (!state.coin || !addressLoaded) return;
    var address = $("pay-address").textContent;
    if (!address || address === "—") return;
    var scheme = state.coin === "btc" ? "bitcoin:" : state.coin === "eth" ? "ethereum:" : "solana:";
    var uri = scheme + address;
    var img = $("qr-img");
    img.src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=" + encodeURIComponent(uri);
    img.hidden = false;
    $("qr-fallback").hidden = true;
  }

  /* ---------- copy button ---------- */
  $("copy-addr").addEventListener("click", function () {
    var addr = $("pay-address").textContent;
    if (!addr || addr === "—") return;
    function done() {
      $("copy-addr").textContent = "Copied!";
      setTimeout(function () {
        $("copy-addr").textContent = "Copy";
      }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(addr).then(done, function () {
        fallbackCopy(addr);
        done();
      });
    } else {
      fallbackCopy(addr);
      done();
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }

  /* ---------- balance + history ---------- */
  function loadHistory() {
    return getSessionKey()
      .then(function (key) {
        return fetch("/api/deposits/" + encodeURIComponent(key));
      })
      .then(function (res) {
        if (!res.ok) throw new Error("history failed");
        return res.json();
      })
      .then(function (items) {
        var list = $("dep-history");
        if (!Array.isArray(items) || !items.length) {
          list.innerHTML = '<li class="dep-empty">No deposits yet.</li>';
          $("side-balance").textContent = fmtUsd(0);
          $("balance-amount").textContent = fmtUsd(0);
          return;
        }
        list.innerHTML = items
          .map(function (d) {
            var tick = COIN_TICK[d.coin] || String(d.coin).toUpperCase();
            var status = d.status === "fulfilled" ? "Fulfilled" : "Not fulfilled";
            return (
              '<li><span>' +
              fmtUsd(Number(d.usd_amount)) +
              " · " +
              tick +
              "</span><em>" +
              status +
              "</em></li>"
            );
          })
          .join("");
        var balance = items
          .filter(function (d) {
            return d.status === "fulfilled";
          })
          .reduce(function (sum, d) {
            return sum + Number(d.usd_amount);
          }, 0);
        $("side-balance").textContent = fmtUsd(balance);
        $("balance-amount").textContent = fmtUsd(balance);
      })
      .catch(function () {
        /* keep defaults on failure */
      });
  }

  /* ---------- init ---------- */
  $("year").textContent = String(new Date().getFullYear());

  getSessionKey()
    .catch(function () {})
    .then(loadRates)
    .then(loadHistory);
})();
