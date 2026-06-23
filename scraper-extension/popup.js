const SCAN_KEY = "bbMemberDealsScan";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

async function getState() {
  return (await chrome.storage.local.get(SCAN_KEY))[SCAN_KEY] || null;
}

function render(state) {
  if (!state) {
    statusEl.innerHTML = "Idle. Ready to scan.";
    return;
  }
  const n = (state.deals || []).length;
  if (state.active) {
    statusEl.innerHTML =
      `<b>Scanning…</b><br>Pages done: <b>${state.pagesScanned || 0}</b><br>Deals collected: <b>${n}</b>` +
      `<br><span class="muted">Last page added ${state.lastCount ?? 0}. Keep this tab open.</span>`;
  } else if (state.done) {
    statusEl.innerHTML =
      `<b>Done ✓</b><br>Scanned <b>${state.pagesScanned || 0}</b> pages.<br>` +
      `Collected <b>${n}</b> deals.<br><span class="muted">Click “Download collected JSON” to save deals.json.</span>`;
  } else {
    statusEl.innerHTML = `Stopped. <b>${n}</b> deals collected so far.`;
  }
}

function downloadJson(deals) {
  const blob = new Blob([JSON.stringify(deals, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "deals.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$("start").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/bestbuy\.com/.test(tab.url || "")) {
    statusEl.innerHTML = "Open the member deals page in this tab first.";
    return;
  }
  const maxPages = Math.max(1, Math.min(50, Number($("maxPages").value) || 20));
  await chrome.storage.local.set({
    [SCAN_KEY]: {
      active: true, done: false, deals: [], pagesScanned: 0, maxPages,
      visited: [], startedAt: Date.now()
    }
  });
  await chrome.tabs.reload(tab.id); // content script picks up the active scan
  statusEl.innerHTML = "<b>Started.</b> Scanning page 1… you can close this popup.";
});

$("download").addEventListener("click", async () => {
  const state = await getState();
  if (!state || !(state.deals || []).length) {
    statusEl.innerHTML = "Nothing collected yet.";
    return;
  }
  downloadJson(state.deals);
});

$("stop").addEventListener("click", async () => {
  const state = (await getState()) || {};
  state.active = false;
  await chrome.storage.local.set({ [SCAN_KEY]: state });
  render(await getState());
});

// live progress while popup is open
(async function tick() {
  render(await getState());
  setTimeout(tick, 1000);
})();
