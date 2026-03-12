export async function loadConfig(state) {
  const params = new URLSearchParams(window.location.search);
  let cfg = {};
  try {
    const res = await fetch("config/config.json", { cache: "no-store" });
    if (res.ok) {
      cfg = await res.json();
    }
  } catch (err) {
    // Optional config file; ignore missing/blocked fetch.
  }

  const beacon = params.get("beacon") || cfg.beaconUrl;
  const metrics = params.get("metrics") || cfg.metricsUrl;
  const mode = params.get("mode") || cfg.mode;
  const ns = params.get("ns") || cfg.apiNamespace;

  if (beacon) {
    state.live.beaconUrl = beacon;
    localStorage.setItem("leanviz_beacon_url", beacon);
  }
  if (metrics) {
    state.live.metricsUrl = metrics;
    localStorage.setItem("leanviz_metrics_url", metrics);
  }
  if (mode) {
    state.mode = mode;
    localStorage.setItem("leanviz_mode", mode);
  }
  if (ns) {
    state.live.apiNamespace = ns;
    localStorage.setItem("leanviz_api_ns", ns);
  }
}
