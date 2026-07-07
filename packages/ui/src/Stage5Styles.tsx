const stageFiveCss = `
.chapter-editor__content{display:block;width:100%;min-height:540px;padding:48px;border:0;outline:none;resize:none;overflow:auto;background:transparent;color:#e7ebf1;font-family:"Noto Serif SC","Songti SC",serif;font-size:17px;line-height:1.95;white-space:pre-wrap}
.knowledge-library-launcher{position:fixed;right:132px;bottom:18px;z-index:18;border:1px solid #527c70;border-radius:999px;background:#20493f;color:#d9fff3;padding:10px 15px}
.knowledge-backdrop{position:fixed;inset:0;z-index:35;display:grid;place-items:center;padding:24px;background:rgba(3,6,11,.84)}
.knowledge-library{width:min(1080px,96vw);max-height:90vh;overflow:hidden;border:1px solid #303b50;border-radius:16px;background:#101722}
.knowledge-header{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #253047}.knowledge-header h2,.knowledge-header p{margin:0}.knowledge-header p{margin-top:6px;color:#7e8da4;font-size:12px}
.knowledge-header button,.knowledge-nav button,.knowledge-nav select,.knowledge-fields input,.knowledge-fields textarea,.knowledge-fields select,.knowledge-actions button{border:1px solid #303b50;border-radius:8px;background:#151c29;color:inherit;padding:7px 10px}
.knowledge-body{display:grid;grid-template-columns:270px minmax(0,1fr);min-height:620px;max-height:calc(90vh - 80px)}.knowledge-nav,.knowledge-form{overflow:auto;padding:16px}.knowledge-nav{border-right:1px solid #253047;background:#0c121c}
.knowledge-nav label,.knowledge-fields label{display:grid;gap:6px}.knowledge-nav label span,.knowledge-fields label span{color:#94a1b6;font-size:12px}.knowledge-nav select,.knowledge-fields input,.knowledge-fields textarea,.knowledge-fields select{width:100%}
.knowledge-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:14px 0}.knowledge-tabs button.active{border-color:#5f76b8;background:#1b2440}.knowledge-list{display:grid;gap:6px;margin-top:14px}.knowledge-list button{display:grid;gap:4px;width:100%;text-align:left}.knowledge-list small{color:#718097}
.knowledge-fields{display:grid;gap:14px}.knowledge-fields textarea{resize:vertical;line-height:1.65}.knowledge-lock{display:flex!important;align-items:center;gap:9px!important}.knowledge-lock input{width:auto}.knowledge-actions{display:flex;justify-content:space-between;margin-top:18px}
@media(max-width:760px){.chapter-editor__content{min-height:430px;padding:24px 18px;font-size:16px}.knowledge-backdrop{padding:0}.knowledge-library{width:100%;height:100vh;max-height:none;border-radius:0}.knowledge-body{display:block;max-height:calc(100vh - 80px);overflow:auto}.knowledge-nav{border-right:0;border-bottom:1px solid #253047}}
`;

if (typeof document !== "undefined" && !document.getElementById("ai-writer-stage-five-styles")) {
  const style = document.createElement("style");
  style.id = "ai-writer-stage-five-styles";
  style.textContent = stageFiveCss;
  document.head.append(style);
}

export {};
