(function(){
"use strict";
const dropZone = document.getElementById("scriptDrop");
const blocksPanel = document.getElementById("blocksPanel");
const guideLine = document.getElementById("guideLine");
const clearBtn = document.getElementById("clearScriptBtn");

const typeColorMap = {};

// 刷新单个积木内部的变量下拉
function refreshBlockVariableSelect(blockDom){
  const sel = blockDom.querySelector(".var-select");
  if(!sel) return;
  const oldVal = sel.value;
  sel.innerHTML = "";
  const list = Object.keys(window.variableDict);
  if(list.length === 0){
    const opt = document.createElement("option");
    opt.textContent="(无变量)";
    opt.value="";
    sel.appendChild(opt);
    sel.disabled=true;
  }else{
    sel.disabled=false;
    list.forEach(name=>{
      const opt = document.createElement("option");
      opt.textContent=name;
      opt.value=name;
      sel.appendChild(opt);
    });
  }
  if(list.includes(oldVal)) sel.value = oldVal;
}

// 刷新脚本区全部变量下拉
function refreshAllVariableSelect(){
  document.querySelectorAll("#scriptDrop .var-select").forEach(sel=>{
    const oldVal = sel.value;
    sel.innerHTML = "";
    const list = Object.keys(window.variableDict);
    if(list.length === 0){
      const opt = document.createElement("option");
      opt.textContent="(无变量)";
      opt.value="";
      sel.appendChild(opt);
      sel.disabled=true;
    }else{
      sel.disabled=false;
      list.forEach(name=>{
        const opt = document.createElement("option");
        opt.textContent=name;
        opt.value=name;
        sel.appendChild(opt);
      });
    }
    if(list.includes(oldVal)) sel.value=oldVal;
  })
  refreshSideVariableGetterBlocks();
}

// 刷新左侧面板的【变量取值】积木
function refreshSideVariableGetterBlocks(){
  const varGroupTitle = Array.from(blocksPanel.querySelectorAll(".block-group-title")).find(t=>t.textContent==="变量");
  if(!varGroupTitle) return;
  let next = varGroupTitle.nextElementSibling;
  while(next){
    const n = next;
    next = next.nextElementSibling;
    if(n.classList.contains("var‑getter‑container") || n.classList.contains("var-create-row")) continue;
    if(n.classList.contains("block") && n.dataset?.blockdata){
      const d = JSON.parse(n.dataset.blockdata||"{}");
      if(d.type==="variable-getter") n.remove();
    }else break;
  }
  const list = Object.keys(window.variableDict);
  if(list.length===0) return;
  list.forEach(varName=>{
    const getterJson = {type:"variable-getter",varName:varName,outputType:"num"};
    const dom = renderBlockDom(getterJson,"variable");
    blocksPanel.insertBefore(dom,varGroupTitle.nextElementSibling);
  })
}

// 创建变量UI
function buildVariableCreateUi(parentDom){
  const row = document.createElement("div");
  row.className="var-create-row";
  const input = document.createElement("input");
  input.placeholder="输入变量名，回车创建";
  const btn = document.createElement("button");
  btn.textContent="新建";

  const createFn = ()=>{
    let name = input.value.trim();
    if(!name) return;
    if(!(name in window.variableDict)){
      window.variableDict[name] = 0;
      refreshAllVariableSelect();
    }
    input.value="";
  };
  btn.onclick = createFn;
  input.onkeydown = (e)=>{
    if(e.key==="Enter") createFn();
  };
  row.appendChild(input);
  row.appendChild(btn);
  parentDom.after(row);
}

// 渲染左侧积木栏
function renderSidePanel(){
  blocksPanel.innerHTML = "";
  window.blockLib.forEach(g=>{
    if(!typeColorMap[g.type]) typeColorMap[g.type] = g.color||"#888";
  });

  window.blockLib.forEach(g=>{
    const title = document.createElement("div");
    title.className = "block-group-title";
    title.textContent = g.group;
    blocksPanel.appendChild(title);

    if(g.type === "variable"){
      buildVariableCreateUi(title);
    }

    g.items.forEach(it=>{
      const dom = renderBlockDom(it.json, it.type);
      blocksPanel.appendChild(dom);
    })
  });
  refreshSideVariableGetterBlocks();
}

//双击导入积木库
clearBtn.addEventListener("dblclick",async ()=>{
  try{
    const text = await navigator.clipboard.readText();
    const imported = JSON.parse(text);
    if(!Array.isArray(imported)) throw new Error("不是数组");
    window.blockLib = imported;
    renderSidePanel();
    alert("✅积木栏导入成功");
  }catch(e){
    console.error(e);
    alert("❌导入失败：剪贴板不是合法blockLib JSON");
  }
});

clearBtn.onclick = function(){
  const blocks = Array.from(dropZone.querySelectorAll(".block"));
  blocks.forEach(b=>b.remove());
};

function parseInputValue(rawValue, inputType){
  const s = String(rawValue).trim();
  switch(inputType){
    case "num":{
      const n = Number(s);
      return isNaN(n) ? 0 : n;
    }
    case "tex": return s;
    case "boo":{
      const low = s.toLowerCase();
      if(low === "true") return true;
      if(low === "false") return false;
      return 0;
    }
    default: return s;
  }
}

function calcCondition(op,valA,valB){
  const a = Number(valA)||0;
  const b = Number(valB)||0;
  switch(op){
    case "eq": return a === b;
    case "gt": return a > b;
    case "lt": return a < b;
    default: return false;
  }
}

function getConditionChipText(condJson){
  const left = condJson.innerLeft[2];
  const mid = condJson.textMid;
  const right = condJson.innerRight[2];
  return `${left}${mid}${right}`;
}

function syncConditionJsonFromDom(dom,json){
  const inputs = dom.querySelectorAll(".input-wrap input");
  if(inputs.length>=2){
    json.innerLeft[2] = inputs[0].value;
    json.innerRight[2] = inputs[1].value;
  }
  return json;
}

// 根据json渲染积木DOM
function renderBlockDom(blockJson, blockType){
  const el = document.createElement("div");
  el.className = "block";
  el.style.backgroundColor = typeColorMap[blockType] || "#888";
  el.dataset.blockdata = JSON.stringify(blockJson);

  // =====变量取值积木（输出积木）=====
  if(blockJson.type === "variable-getter"){
    el.append(document.createTextNode(`变量 ${blockJson.varName}`));
    return el;
  }

  // =====设置/增加变量积木=====
  if(blockJson.type === "variable"){
    el.append(document.createTextNode(blockJson.text));
    const selWrap = document.createElement("span");
    const sel = document.createElement("select");
    sel.className="var-select";
    sel.onchange=()=>{
      const d = JSON.parse(el.dataset.blockdata);
      d.varName = sel.value;
      el.dataset.blockdata = JSON.stringify(d);
    };
    selWrap.appendChild(sel);
    el.appendChild(selWrap);
    el.append(document.createTextNode(blockJson.text2));

    if(blockJson.inner && Array.isArray(blockJson.inner)){
      const [inputType,enable,defVal] = blockJson.inner;
      const inWrap = document.createElement("span");
      inWrap.className="input-wrap";
      // 如果绑定变量引用，渲染芯片
      if(blockJson.innerRefVar){
        inWrap.classList.add("slot-hide-input");
        const chip = document.createElement("span");
        chip.className="var-value-chip";
        chip.dataset.refvar = blockJson.innerRefVar;
        chip.textContent = `变量 ${blockJson.innerRefVar}`;
        inWrap.appendChild(chip);
      }else{
        const inp = document.createElement("input");
        inp.type = inputType === "num" ? "number" : "text";
        inp.value = defVal;
        inp.dataset.inputKind = inputType;
        if(!enable) inp.readOnly=true;
        inp.oninput=()=>{
          const d = JSON.parse(el.dataset.blockdata);
          d.inner[2] = inp.value;
          d.innerRefVar = null;
          el.dataset.blockdata = JSON.stringify(d);
        };
        inWrap.appendChild(inp);
      }
      el.appendChild(inWrap);
    }
    return el;
  }

  if(blockJson.type === "condition"){
    const [typeL,enableL,defL] = blockJson.innerLeft;
    const [typeR,enableR,defR] = blockJson.innerRight;

    const wrapL = document.createElement("span");
    wrapL.className="input-wrap";
    if(blockJson.innerLeftRefVar){
      wrapL.classList.add("slot-hide-input");
      const chip = document.createElement("span");
      chip.className="var-value-chip";
      chip.textContent=`变量 ${blockJson.innerLeftRefVar}`;
      wrapL.appendChild(chip);
    }else{
      const inpL = document.createElement("input");
      inpL.type = typeL==="num"?"number":"text";
      inpL.value = defL;
      inpL.dataset.inputKind = typeL;
      if(!enableL) inpL.readOnly=true;
      wrapL.appendChild(inpL);
    }

    const midText = document.createTextNode(" "+blockJson.textMid+" ");

    const wrapR = document.createElement("span");
    wrapR.className="input-wrap";
    if(blockJson.innerRightRefVar){
      wrapR.classList.add("slot-hide-input");
      const chip = document.createElement("span");
      chip.className="var-value-chip";
      chip.textContent=`变量 ${blockJson.innerRightRefVar}`;
      wrapR.appendChild(chip);
    }else{
      const inpR = document.createElement("input");
      inpR.type = typeR==="num"?"number":"text";
      inpR.value = defR;
      inpR.dataset.inputKind = typeR;
      if(!enableR) inpR.readOnly=true;
      wrapR.appendChild(inpR);
    }

    el.appendChild(wrapL);
    el.appendChild(midText);
    el.appendChild(wrapR);
    return el;
  }

  if(blockJson.main){
    const m = blockJson.main;
    el.append(document.createTextNode(m.text));
    if(m.inner && Array.isArray(m.inner)){
      const [inputType,enable,defVal] = m.inner;
      const inWrap = document.createElement("span");
      inWrap.className = "input-wrap";
      // 布尔插槽
      if(m.inner[0]==="boo"){
        inWrap.classList.add("slot-hide-input");
        if(m.slotBlock){
          const chip = document.createElement("span");
          chip.className="slot-bool-chip";
          chip.dataset.slotdata = JSON.stringify(m.slotBlock);
          chip.textContent = getConditionChipText(m.slotBlock);
          inWrap.appendChild(chip);
        }
      }else if(m.innerRefVar){
        // num/txt绑定变量引用
        inWrap.classList.add("slot-hide-input");
        const chip = document.createElement("span");
        chip.className="var-value-chip";
        chip.dataset.refvar = m.innerRefVar;
        chip.textContent = `变量 ${m.innerRefVar}`;
        inWrap.appendChild(chip);
      }else{
        const inp = document.createElement("input");
        inp.type = inputType === "num" ? "number" : "text";
        inp.value = defVal;
        inp.dataset.inputKind = inputType;
        if(!enable){
          inp.readOnly = true;
        }
        inp.oninput=()=>{
          const d = JSON.parse(el.dataset.blockdata);
          d.main.inner[2] = inp.value;
          d.main.innerRefVar = null;
          el.dataset.blockdata = JSON.stringify(d);
        };
        inWrap.appendChild(inp);
      }
      el.appendChild(inWrap);
    }
    if(m.text2){
      el.append(document.createTextNode(m.text2));
    }
  }else{
    el.append(document.createTextNode(blockJson.text));
    if(blockJson.inner && Array.isArray(blockJson.inner)){
      const [inputType,enable,defVal] = blockJson.inner;
      const inWrap = document.createElement("span");
      inWrap.className = "input-wrap";
      if(blockJson.innerRefVar){
        inWrap.classList.add("slot-hide-input");
        const chip = document.createElement("span");
        chip.className="var-value-chip";
        chip.dataset.refvar = blockJson.innerRefVar;
        chip.textContent = `变量 ${blockJson.innerRefVar}`;
        inWrap.appendChild(chip);
      }else{
        const inp = document.createElement("input");
        inp.type = inputType === "num" ? "number" : "text";
        inp.value = defVal;
        inp.dataset.inputKind = inputType;
        if(!enable){
          inp.readOnly = true;
        }
        inp.oninput=()=>{
          const d = JSON.parse(el.dataset.blockdata);
          d.inner[2] = inp.value;
          d.innerRefVar = null;
          el.dataset.blockdata = JSON.stringify(d);
        };
        inWrap.appendChild(inp);
      }
      el.appendChild(inWrap);
    }
    if(blockJson.text2){
      el.append(document.createTextNode(blockJson.text2));
    }
  }
  return el;
}

renderSidePanel();

function getTouch(e){
  if(e.changedTouches && e.changedTouches.length>0) return e.changedTouches[0];
  return null;
}

function updateGuideLine(y){
  const blks = Array.from(dropZone.querySelectorAll(".block"));
  let insertBeforeEl = null;
  if(blks.length === 0){
    guideLine.style.top = "0px";
    guideLine.style.display = "block";
    return insertBeforeEl;
  }
  for(let i=0;i<blks.length;i++){
    const rect = blks[i].getBoundingClientRect();
    if(y < rect.top + rect.height/2){
      insertBeforeEl = blks[i];
      guideLine.style.top = rect.top - dropZone.getBoundingClientRect().top + "px";
      guideLine.style.display = "block";
      return insertBeforeEl;
    }
  }
  const lastRect = blks[blks.length-1].getBoundingClientRect();
  guideLine.style.top = (lastRect.bottom - dropZone.getBoundingClientRect().top) + "px";
  guideLine.style.display = "block";
  return insertBeforeEl;
}

function hideGuideLine(){
  guideLine.style.display = "none";
}

let dragSrcEl = null;
let dragPreview = null;
let touchId = null;
let isReorder = false;
let dragTouchX=0,dragTouchY=0;
let hoverSlotWrap=null;
let dragSlotChipData=null;

function resetDrag(){
  hideGuideLine();
  if(dragSrcEl) dragSrcEl.classList.remove("dragging-ghost");
  if(dragPreview) dragPreview.remove();
  if(hoverSlotWrap) hoverSlotWrap.classList.remove("slot-target");
  hoverSlotWrap=null;
  dragSrcEl = null;
  dragPreview = null;
  touchId = null;
  isReorder = false;
  dragSlotChipData=null;
}

//查找可以接收变量取值积木的num/txt输入框容器
function findNumInputWrapAtPos(x,y){
  const allWraps = Array.from(dropZone.querySelectorAll(".input-wrap"));
  for(const wrap of allWraps){
    const blockDom = wrap.closest(".block");
    if(!blockDom) continue;
    const json = JSON.parse(blockDom.dataset.blockdata);
    let innerDef = null;
    if(json.main) innerDef = json.main.inner;
    else if(json.inner) innerDef = json.inner;
    if(!innerDef) continue;
    const [tp,,] = innerDef;
    if(tp!=="num"&&tp!=="tex") continue;
    if(wrap.querySelector(".var-value-chip")) continue;
    const rect = wrap.getBoundingClientRect();
    if(x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom){
      return {wrap,blockDom,json};
    }
  }
  return null;
}

function findBoolSlotWrapAtPos(x,y){
  const allWraps = Array.from(dropZone.querySelectorAll(".input-wrap"));
  for(const wrap of allWraps){
    const blockDom = wrap.closest(".block");
    if(!blockDom) continue;
    const json = JSON.parse(blockDom.dataset.blockdata);
    if(!json.main) continue;
    const inner = json.main.inner;
    if(!inner || inner[0]!=="boo" || inner[1]!==false) continue;
    const rect = wrap.getBoundingClientRect();
    if(x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom){
      return wrap;
    }
  }
  return null;
}

document.addEventListener("touchstart",e=>{
  const target = e.target;
  if(target.classList.contains("slot-bool-chip")||target.classList.contains("var-value-chip")){
    dragSlotChipData = JSON.parse(target.dataset.slotdata||target.dataset.refvar);
    const parentWrap = target.closest(".input-wrap");
    const parentBlock = parentWrap.closest(".block");
    dragSrcEl = parentBlock;
  }
  if(target.tagName === "INPUT" || target.tagName==="SELECT"){
    return;
  }
  const blockEl = target.closest(".block");
  if(!blockEl) return;

  const t = getTouch(e);
  if(!t) return;
  e.preventDefault();
  dragTouchX = t.clientX;
  dragTouchY = t.clientY;

  touchId = t.identifier;
  if(!dragSlotChipData){
    dragSrcEl = blockEl;
  }
  isReorder = dropZone.contains(dragSrcEl);
  if(isReorder){
    dragSrcEl.classList.add("dragging-ghost");
  }
  dragPreview = document.createElement("div");
  dragPreview.className = "drag-preview";
  if(dragSlotChipData){
    dragPreview.style.backgroundColor="#ff9800";
    dragPreview.style.color="#fff";
    dragPreview.style.padding="4px 8px";
    dragPreview.textContent=`变量 ${dragSlotChipData}`;
  }else{
    dragPreview.style.backgroundColor = dragSrcEl.style.backgroundColor;
    dragPreview.innerHTML = dragSrcEl.innerHTML;
  }
  document.body.appendChild(dragPreview);
  dragPreview.style.left = (t.clientX - 30)+"px";
  dragPreview.style.top = (t.clientY -20)+"px";
},{passive:false});

document.addEventListener("touchmove",e=>{
  if(!dragSrcEl) return;
  const t = getTouch(e);
  if(!t || t.identifier !== touchId) return;
  e.preventDefault();
  dragTouchX = t.clientX;
  dragTouchY = t.clientY;
  dragPreview.style.left = (t.clientX -30)+"px";
  dragPreview.style.top = (t.clientY -20)+"px";

  if(hoverSlotWrap) hoverSlotWrap.classList.remove("slot-target");
  hoverSlotWrap = findBoolSlotWrapAtPos(t.clientX,t.clientY) || findNumInputWrapAtPos(t.clientX,t.clientY)?.wrap||null;
  if(hoverSlotWrap){
    hoverSlotWrap.classList.add("slot-target");
  }

  const dropRect = dropZone.getBoundingClientRect();
  if(t.clientX >= dropRect.left && t.clientX <= dropRect.right){
    updateGuideLine(t.clientY);
  }else{
    hideGuideLine();
  }
},{passive:false});

document.addEventListener("touchend",e=>{
  if(!dragSrcEl) return;
  const t = getTouch(e);
  if(!t || t.identifier !== touchId){
    resetDrag();
    return;
  }

  const panelRect = blocksPanel.getBoundingClientRect();
  if(t.clientX <= panelRect.right){
    if(isReorder){
      if(dragSlotChipData){
        const pJson = JSON.parse(dragSrcEl.dataset.blockdata);
        delete pJson.main.slotBlock;
        delete pJson.main.innerRefVar;
        dragSrcEl.replaceWith(renderBlockDom(pJson,"control"));
      }else{
        const srcJson = JSON.parse(dragSrcEl.dataset.blockdata);
        if(srcJson.main && srcJson.alde === true){
          const nextSib = dragSrcEl.nextElementSibling;
          if(nextSib && nextSib.classList.contains("block")){
            nextSib.remove();
          }
        }
        dragSrcEl.remove();
      }
    }
    resetDrag();
    return;
  }

  // 变量取值积木丢入num输入框
  const numSlotHit = findNumInputWrapAtPos(t.clientX,t.clientY);
  if(numSlotHit){
    const {blockDom,json} = numSlotHit;
    const dragData = JSON.parse(dragSrcEl.dataset.blockdata);
    if(dragData.type === "variable-getter"){
      const varName = dragData.varName;
      if(json.main){
        json.main.innerRefVar = varName;
      }else{
        json.innerRefVar = varName;
      }
      blockDom.replaceWith(renderBlockDom(json,json.type));
      if(!isReorder) dragSrcEl.remove();
      resetDrag();
      return;
    }
  }

  if(hoverSlotWrap && !dragSlotChipData){
    let srcData = JSON.parse(dragSrcEl.dataset.blockdata);
    if(srcData.outputType === "boo"){
      srcData = syncConditionJsonFromDom(dragSrcEl,srcData);
      const parentBlock = hoverSlotWrap.closest(".block");
      const pJson = JSON.parse(parentBlock.dataset.blockdata);
      pJson.main.slotBlock = srcData;
      parentBlock.replaceWith(renderBlockDom(pJson,"control"));
      if(isReorder){
        dragSrcEl.remove();
      }
      resetDrag();
      return;
    }
  }

  const dropRect = dropZone.getBoundingClientRect();
  if(t.clientX >= dropRect.left && t.clientX <= dropRect.right){
    const insertBeforeEl = updateGuideLine(t.clientY);
    if(dragSlotChipData){
      const pJson = JSON.parse(dragSrcEl.dataset.blockdata);
      delete pJson.main.slotBlock;
      dragSrcEl.replaceWith(renderBlockDom(pJson,"control"));
    }else if(isReorder){
      if(insertBeforeEl){
        dropZone.insertBefore(dragSrcEl,insertBeforeEl);
      }else{
        dropZone.appendChild(dragSrcEl);
      }
      refreshBlockVariableSelect(dragSrcEl);
    }else{
      const srcData = JSON.parse(dragSrcEl.dataset.blockdata);
      const findType = (el)=>{
        const panelItems = Array.from(blocksPanel.querySelectorAll(".block"));
        for(let p of panelItems){
          if(p === el){
            const json = JSON.parse(p.dataset.blockdata||"{}");
            if(json.main) return json.main.type;
            return json.type;
          }
        }
        return "control";
      };
      const tp = findType(dragSrcEl);
      const newDom = renderBlockDom(srcData,tp);
      if(srcData.son){
        const sonDom = renderBlockDom(srcData.son,tp);
        if(insertBeforeEl){
          dropZone.insertBefore(newDom,insertBeforeEl);
          dropZone.insertBefore(sonDom,insertBeforeEl);
        }else{
          dropZone.appendChild(newDom);
          dropZone.appendChild(sonDom);
        }
        refreshBlockVariableSelect(newDom);
      }else{
        if(insertBeforeEl){
          dropZone.insertBefore(newDom,insertBeforeEl);
        }else{
          dropZone.appendChild(newDom);
        }
        refreshBlockVariableSelect(newDom);
      }
    }
  }
  resetDrag();
},{passive:false});

document.addEventListener("touchcancel",resetDrag);

})();