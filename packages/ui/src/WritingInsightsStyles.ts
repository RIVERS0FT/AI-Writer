const writingInsightsCss = `
.writing-insights-launcher{position:fixed;right:250px;bottom:18px;z-index:18;border:1px solid #8a6d3d;border-radius:999px;background:#4f3b1d;color:#ffe7b2;padding:10px 15px}
.writing-insights-backdrop{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:24px;background:rgba(3,6,11,.86)}
.writing-insights{width:min(1240px,97vw);max-height:92vh;overflow:hidden;border:1px solid #303b50;border-radius:16px;background:#101722;color:#d8deea}
.writing-insights__header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #253047}.writing-insights__header h2,.writing-insights__header p{margin:0}.writing-insights__header p{margin-top:6px;color:#7e8da4;font-size:12px}.writing-insights__header-actions{display:flex;gap:8px}.writing-insights__header button,.writing-insights select,.writing-job-list button{border:1px solid #303b50;border-radius:8px;background:#151c29;color:inherit;padding:7px 10px}
.writing-insights__error{margin:12px 18px 0;padding:9px 11px;border-radius:8px;background:#311923;color:#ffd2d8}
.writing-insights__body{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:660px;max-height:calc(92vh - 82px)}
.writing-insights__sidebar,.writing-insights__content{overflow:auto;padding:16px}.writing-insights__sidebar{border-right:1px solid #253047;background:#0c121c}.writing-insights__sidebar label{display:grid;gap:6px}.writing-insights__sidebar label span{color:#94a1b6;font-size:12px}.writing-insights__sidebar select{width:100%}.writing-insights__sidebar h3,.writing-insights__content h3{margin:16px 0 10px;font-size:13px;color:#aeb9ca}
.writing-job-list{display:grid;gap:7px}.writing-job-list button{display:grid;grid-template-columns:1fr auto;gap:4px;text-align:left}.writing-job-list button.active{border-color:#6c78c5;background:#1b2440}.writing-job-list strong{font-size:12px}.writing-job-list span,.writing-job-list small{font-size:10px;color:#7e8da4}.writing-job-list small{grid-column:1/-1}
.usage-summary-card{margin-top:14px;padding:12px;border:1px solid #29354d;border-radius:10px;background:#111a28}.usage-summary-card h3{margin:0 0 10px}.usage-summary-card dl{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0}.usage-summary-card dl div{padding:7px;border-radius:7px;background:#0c131f}.usage-summary-card dt{color:#718097;font-size:10px}.usage-summary-card dd{margin:3px 0 0;font-size:13px}.usage-summary-card p{margin:9px 0 0;color:#718097;font-size:10px}
.writing-job-overview{display:flex;justify-content:space-between;gap:20px;padding:14px;border:1px solid #29354d;border-radius:11px;background:#0e1520}.writing-job-overview h3{margin:0}.writing-job-overview p{max-width:600px;margin:7px 0 0;color:#8896ab;font-size:12px;line-height:1.5}.writing-job-overview dl{display:grid;grid-template-columns:repeat(2,minmax(100px,1fr));gap:8px;margin:0}.writing-job-overview dl div{padding:7px;border-radius:7px;background:#121c2b}.writing-job-overview dt{color:#718097;font-size:10px}.writing-job-overview dd{margin:3px 0 0;font-size:11px}
.writing-step-list{display:grid;gap:8px}.writing-step-list article{padding:11px;border:1px solid #29354d;border-radius:10px;background:#0e1520}.writing-step-list article header{display:flex;justify-content:space-between;gap:10px}.writing-step-list article header span{font-size:11px;color:#8f9db2}.writing-step-list article header span[data-status="completed"]{color:#83d59b}.writing-step-list article header span[data-status="failed"]{color:#ef879a}.writing-step-list article header span[data-status="running"]{color:#ffd27d}.writing-step-metrics{display:flex;flex-wrap:wrap;gap:9px;margin-top:8px;color:#718097;font-size:10px}.writing-step-list article small{display:block;margin-top:7px;color:#63738a}
.writing-request-table-wrap{overflow:auto;border:1px solid #29354d;border-radius:10px}.writing-request-table{width:100%;border-collapse:collapse;min-width:800px}.writing-request-table th,.writing-request-table td{padding:8px 9px;border-bottom:1px solid #202b3f;text-align:left;font-size:10px}.writing-request-table th{position:sticky;top:0;background:#151e2c;color:#8d9bb0}.writing-request-table td{color:#b5c0d0}.writing-insights__empty{display:grid;place-items:center;min-height:500px;color:#718097}
@media(max-width:900px){.writing-insights-launcher{right:250px}.writing-insights-backdrop{padding:0}.writing-insights{width:100%;height:100vh;max-height:none;border-radius:0}.writing-insights__body{display:block;max-height:calc(100vh - 82px);overflow:auto}.writing-insights__sidebar{border-right:0;border-bottom:1px solid #253047}.writing-job-overview{display:block}.writing-job-overview dl{margin-top:12px}}
@media(max-width:560px){.writing-insights-launcher{right:18px;bottom:66px}.writing-job-overview dl{grid-template-columns:1fr}.usage-summary-card dl{grid-template-columns:1fr 1fr}}
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("ai-writer-writing-insights-styles")
) {
  const style = document.createElement("style");
  style.id = "ai-writer-writing-insights-styles";
  style.textContent = writingInsightsCss;
  document.head.append(style);
}

export {};
