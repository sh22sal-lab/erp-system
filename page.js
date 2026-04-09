"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "pungnong-moseulpo-erp-v1";
const initialData = {
  items: [
    { id: "i1", name: "21-17-17", unit: "포", buyPrice: 18000, sellPrice: 22000 },
    { id: "i2", name: "21-6-7", unit: "포", buyPrice: 17500, sellPrice: 21500 },
    { id: "i3", name: "규산질", unit: "포", buyPrice: 8000, sellPrice: 11000 }
  ],
  partners: [
    { id: "p1", name: "대광농가A", type: "농가", phone: "010-0000-0001", groupName: "대광1반" },
    { id: "p2", name: "대광농가B", type: "농가", phone: "010-0000-0002", groupName: "대광2반" },
    { id: "p3", name: "동부농협", type: "검수처", phone: "064-000-1000", groupName: "" },
    { id: "p4", name: "서부신협", type: "검수처", phone: "064-000-2000", groupName: "" }
  ],
  drivers: [
    { id: "d1", name: "김기사", type: "겸용", phone: "010-1111-1111" },
    { id: "d2", name: "이기사", type: "살포", phone: "010-2222-2222" }
  ],
  transactions: [],
  receipts: []
};

const fn = (v) => new Intl.NumberFormat("ko-KR").format(Number(v || 0));
const fc = (v) => `${fn(v)}원`;
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const calcLine = (line) => {
  const base = Number(line.qty || 0) * Number(line.unitPrice || 0);
  const dv = Number(line.discountValue || 0);
  if (line.discountType === "금액") return Math.max(0, base - dv);
  if (line.discountType === "%") return Math.max(0, base - Math.round(base * dv / 100));
  return base;
};

function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(initialData);
  useEffect(() => { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setData(JSON.parse(raw)); }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  const [itemForm, setItemForm] = useState({ name: "", unit: "포", buyPrice: "", sellPrice: "" });
  const [partnerForm, setPartnerForm] = useState({ name: "", type: "농가", phone: "", groupName: "" });
  const [driverForm, setDriverForm] = useState({ name: "", type: "겸용", phone: "" });
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().slice(0, 10), partnerId: "", inspectionOrgId: "",
    inspectionStatus: "검수대기", deliveryType: "자가", deliveryDriver: "", sprayDriver: "", sprayCost: "", paid: "", memo: ""
  });
  const [lineItems, setLineItems] = useState([{ itemId: "", qty: "", unitPrice: "", discountType: "없음", discountValue: "" }]);
  const [receiptForm, setReceiptForm] = useState({ date: new Date().toISOString().slice(0, 10), partnerId: "", amount: "", memo: "" });

  const itemMap = useMemo(() => Object.fromEntries(data.items.map((x) => [x.id, x])), [data.items]);
  const partnerMap = useMemo(() => Object.fromEntries(data.partners.map((x) => [x.id, x])), [data.partners]);

  const dashboard = useMemo(() => {
    const totalSales = data.transactions.reduce((s, t) => s + Number(t.totalAmount || 0), 0);
    const totalPaid = data.transactions.reduce((s, t) => s + Number(t.paid || 0), 0) + data.receipts.reduce((s, r) => s + Number(r.amount || 0), 0);
    return {
      totalSales, totalPaid,
      receivable: totalSales - totalPaid,
      pendingInspection: data.transactions.filter((t) => t.inspectionStatus === "검수대기").length
    };
  }, [data]);

  const receivableRows = useMemo(() => {
    const sales = {}, paid = {};
    data.transactions.forEach((t) => { sales[t.partnerId] = (sales[t.partnerId] || 0) + Number(t.totalAmount || 0); paid[t.partnerId] = (paid[t.partnerId] || 0) + Number(t.paid || 0); });
    data.receipts.forEach((r) => { paid[r.partnerId] = (paid[r.partnerId] || 0) + Number(r.amount || 0); });
    return data.partners.filter((p) => p.type === "농가").map((p) => ({
      partnerId: p.id, name: p.name, sales: sales[p.id] || 0, paid: paid[p.id] || 0, balance: (sales[p.id] || 0) - (paid[p.id] || 0)
    })).filter((r) => r.sales || r.paid || r.balance).sort((a,b)=>b.balance-a.balance);
  }, [data]);

  const driverRows = useMemo(() => data.drivers.map((d) => {
    const txs = data.transactions.filter((t) => t.sprayDriver === d.name || t.deliveryDriver === d.name);
    const sprayAmount = txs.filter((t) => t.sprayDriver === d.name).reduce((s, t) => s + Number(t.sprayCost || 0), 0);
    return { name: d.name, count: txs.length, sprayAmount };
  }), [data]);

  const addItem = () => {
    if (!itemForm.name) return;
    setData((p) => ({ ...p, items: [...p.items, { id: uid("i"), name: itemForm.name, unit: itemForm.unit, buyPrice: Number(itemForm.buyPrice || 0), sellPrice: Number(itemForm.sellPrice || 0) }] }));
    setItemForm({ name: "", unit: "포", buyPrice: "", sellPrice: "" });
  };
  const addPartner = () => {
    if (!partnerForm.name) return;
    setData((p) => ({ ...p, partners: [...p.partners, { id: uid("p"), ...partnerForm }] }));
    setPartnerForm({ name: "", type: "농가", phone: "", groupName: "" });
  };
  const addDriver = () => {
    if (!driverForm.name) return;
    setData((p) => ({ ...p, drivers: [...p.drivers, { id: uid("d"), ...driverForm }] }));
    setDriverForm({ name: "", type: "겸용", phone: "" });
  };
  const addLine = () => setLineItems((p) => [...p, { itemId: "", qty: "", unitPrice: "", discountType: "없음", discountValue: "" }]);
  const removeLine = (idx) => setLineItems((p) => p.length === 1 ? p : p.filter((_, i) => i !== idx));
  const updateLine = (idx, patch) => setLineItems((p) => p.map((line, i) => i === idx ? { ...line, ...patch } : line));
  const selectItemForLine = (idx, itemId) => updateLine(idx, { itemId, unitPrice: itemMap[itemId] ? String(itemMap[itemId].sellPrice) : "" });

  const addTransaction = () => {
    const valid = lineItems.filter((l) => l.itemId && l.qty && l.unitPrice);
    if (!txForm.partnerId || !valid.length) return;
    const totalAmount = valid.reduce((s, l) => s + calcLine(l), 0) + Number(txForm.sprayCost || 0);
    const lines = valid.map((l) => ({ ...l, itemName: itemMap[l.itemId]?.name || "" }));
    setData((p) => ({ ...p, transactions: [{ id: uid("t"), ...txForm, sprayCost: Number(txForm.sprayCost || 0), paid: Number(txForm.paid || 0), totalAmount, lines }, ...p.transactions] }));
    setTxForm({ date: new Date().toISOString().slice(0, 10), partnerId: "", inspectionOrgId: "", inspectionStatus: "검수대기", deliveryType: "자가", deliveryDriver: "", sprayDriver: "", sprayCost: "", paid: "", memo: "" });
    setLineItems([{ itemId: "", qty: "", unitPrice: "", discountType: "없음", discountValue: "" }]);
  };
  const addReceipt = () => {
    if (!receiptForm.partnerId || !receiptForm.amount) return;
    setData((p) => ({ ...p, receipts: [{ id: uid("r"), ...receiptForm, amount: Number(receiptForm.amount) }, ...p.receipts] }));
    setReceiptForm({ date: new Date().toISOString().slice(0, 10), partnerId: "", amount: "", memo: "" });
  };
  const resetLocalData = () => { if (confirm("브라우저 데이터를 초기화할까요?")) { localStorage.removeItem(STORAGE_KEY); setData(initialData); } };
  const exportTransactions = () => downloadCsv("출고내역.csv", [["날짜","농가","검수처","검수상태","수령방식","배달기사","살포기사","살포비","당일수금","총금액","품목내역","메모"], ...data.transactions.map((tx)=>[tx.date, partnerMap[tx.partnerId]?.name || "", partnerMap[tx.inspectionOrgId]?.name || "", tx.inspectionStatus, tx.deliveryType, tx.deliveryDriver, tx.sprayDriver, tx.sprayCost, tx.paid, tx.totalAmount, tx.lines.map((l)=>`${l.itemName} ${l.qty}${itemMap[l.itemId]?.unit || ""}`).join(" / "), tx.memo])]);
  const exportReceivables = () => downloadCsv("미수현황.csv", [["농가","총출고","총수금","미수금"], ...receivableRows.map((r)=>[r.name, r.sales, r.paid, r.balance])]);
  const exportDrivers = () => downloadCsv("기사정산.csv", [["기사명","건수","살포비합계"], ...driverRows.map((r)=>[r.name, r.count, r.sprayAmount])]);

  return (
    <div className="container">
      <div className="header">
        <div><h1 className="title">풍농모슬포ERP</h1><p className="subtitle">출고 · 검수 · 미수 · 기사정산 1차 실행형</p></div>
        <div className="toolbar">
          <button className="secondary small-btn" onClick={exportTransactions}>출고내역 엑셀</button>
          <button className="secondary small-btn" onClick={exportReceivables}>미수현황 엑셀</button>
          <button className="secondary small-btn" onClick={exportDrivers}>기사정산 엑셀</button>
          <button className="ghost small-btn" onClick={resetLocalData}>브라우저 데이터 초기화</button>
        </div>
      </div>

      <div className="warning" style={{ marginBottom: 16 }}>현재 버전은 같은 브라우저에만 저장됩니다. 다음 단계에서 서버 저장으로 바꾸면 여러 직원이 같은 데이터로 함께 쓸 수 있습니다.</div>

      <div className="grid cards">
        <div className="card"><div className="kpi-label">총 출고금액</div><div className="kpi-value">{fc(dashboard.totalSales)}</div></div>
        <div className="card"><div className="kpi-label">총 수금액</div><div className="kpi-value">{fc(dashboard.totalPaid)}</div></div>
        <div className="card"><div className="kpi-label">총 미수금</div><div className="kpi-value">{fc(dashboard.receivable)}</div></div>
        <div className="card"><div className="kpi-label">검수대기</div><div className="kpi-value">{fn(dashboard.pendingInspection)}건</div></div>
      </div>

      <div className="tabs">
        {[
          ["dashboard","대시보드"],["items","품목관리"],["partners","거래처관리"],["drivers","기사관리"],["transactions","출고등록"],["receivables","미수관리"],["inspections","검수관리"]
        ].map(([k,l]) => <button key={k} className={`tab-btn ${tab===k ? "active":""}`} onClick={()=>setTab(k)}>{l}</button>)}
      </div>

      {tab === "dashboard" && <div className="card"><h3>미수 상위 농가</h3><div className="table-wrap"><table><thead><tr><th>농가</th><th className="right">총출고</th><th className="right">총수금</th><th className="right">미수금</th></tr></thead><tbody>{receivableRows.slice(0,10).map((r)=><tr key={r.partnerId}><td>{r.name}</td><td className="right">{fc(r.sales)}</td><td className="right">{fc(r.paid)}</td><td className="right">{fc(r.balance)}</td></tr>)}</tbody></table></div></div>}

      {tab === "items" && <div className="two-col"><div className="card"><h3>품목 등록</h3><div className="form-group"><label>품목명</label><input value={itemForm.name} onChange={(e)=>setItemForm({...itemForm,name:e.target.value})} /></div><div className="form-row"><div className="form-group"><label>단위</label><input value={itemForm.unit} onChange={(e)=>setItemForm({...itemForm,unit:e.target.value})} /></div><div className="form-group"><label>매입단가</label><input type="number" value={itemForm.buyPrice} onChange={(e)=>setItemForm({...itemForm,buyPrice:e.target.value})} /></div></div><div className="form-group"><label>판매단가</label><input type="number" value={itemForm.sellPrice} onChange={(e)=>setItemForm({...itemForm,sellPrice:e.target.value})} /></div><button onClick={addItem}>품목 추가</button></div><div className="card"><h3>품목 목록</h3><div className="table-wrap"><table><thead><tr><th>품목명</th><th>단위</th><th className="right">매입단가</th><th className="right">판매단가</th></tr></thead><tbody>{data.items.map((i)=><tr key={i.id}><td>{i.name}</td><td>{i.unit}</td><td className="right">{fc(i.buyPrice)}</td><td className="right">{fc(i.sellPrice)}</td></tr>)}</tbody></table></div></div></div>}

      {tab === "partners" && <div className="two-col"><div className="card"><h3>거래처 등록</h3><div className="form-group"><label>거래처명</label><input value={partnerForm.name} onChange={(e)=>setPartnerForm({...partnerForm,name:e.target.value})} /></div><div className="form-row"><div className="form-group"><label>유형</label><select value={partnerForm.type} onChange={(e)=>setPartnerForm({...partnerForm,type:e.target.value})}><option>농가</option><option>검수처</option><option>매입처</option></select></div><div className="form-group"><label>연락처</label><input value={partnerForm.phone} onChange={(e)=>setPartnerForm({...partnerForm,phone:e.target.value})} /></div></div><div className="form-group"><label>영농회/그룹</label><input value={partnerForm.groupName} onChange={(e)=>setPartnerForm({...partnerForm,groupName:e.target.value})} /></div><button onClick={addPartner}>거래처 추가</button></div><div className="card"><h3>거래처 목록</h3><div className="table-wrap"><table><thead><tr><th>이름</th><th>유형</th><th>연락처</th><th>영농회/그룹</th></tr></thead><tbody>{data.partners.map((p)=><tr key={p.id}><td>{p.name}</td><td>{p.type}</td><td>{p.phone}</td><td>{p.groupName || "-"}</td></tr>)}</tbody></table></div></div></div>}

      {tab === "drivers" && <div className="two-col"><div className="card"><h3>기사 등록</h3><div className="form-group"><label>기사명</label><input value={driverForm.name} onChange={(e)=>setDriverForm({...driverForm,name:e.target.value})} /></div><div className="form-row"><div className="form-group"><label>유형</label><select value={driverForm.type} onChange={(e)=>setDriverForm({...driverForm,type:e.target.value})}><option>겸용</option><option>배달</option><option>살포</option></select></div><div className="form-group"><label>연락처</label><input value={driverForm.phone} onChange={(e)=>setDriverForm({...driverForm,phone:e.target.value})} /></div></div><button onClick={addDriver}>기사 추가</button></div><div className="card"><h3>기사 정산 요약</h3><div className="table-wrap"><table><thead><tr><th>기사명</th><th className="right">건수</th><th className="right">살포비 합계</th></tr></thead><tbody>{driverRows.map((r)=><tr key={r.name}><td>{r.name}</td><td className="right">{fn(r.count)}</td><td className="right">{fc(r.sprayAmount)}</td></tr>)}</tbody></table></div></div></div>}

      {tab === "transactions" && <div className="two-col"><div className="card"><h3>다품목 출고 등록</h3><div className="form-row"><div className="form-group"><label>날짜</label><input type="date" value={txForm.date} onChange={(e)=>setTxForm({...txForm,date:e.target.value})} /></div><div className="form-group"><label>농가</label><select value={txForm.partnerId} onChange={(e)=>setTxForm({...txForm,partnerId:e.target.value})}><option value="">선택</option>{data.partners.filter((p)=>p.type==="농가").map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div><div className="form-row"><div className="form-group"><label>검수처</label><select value={txForm.inspectionOrgId} onChange={(e)=>setTxForm({...txForm,inspectionOrgId:e.target.value})}><option value="">선택</option>{data.partners.filter((p)=>p.type==="검수처").map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="form-group"><label>검수상태</label><select value={txForm.inspectionStatus} onChange={(e)=>setTxForm({...txForm,inspectionStatus:e.target.value})}><option>검수대기</option><option>검수완료</option><option>청구완료</option></select></div></div><div className="form-row-3"><div className="form-group"><label>수령방식</label><select value={txForm.deliveryType} onChange={(e)=>setTxForm({...txForm,deliveryType:e.target.value})}><option>자가</option><option>배달</option><option>살포</option><option>배달+살포</option></select></div><div className="form-group"><label>배달기사</label><select value={txForm.deliveryDriver} onChange={(e)=>setTxForm({...txForm,deliveryDriver:e.target.value})}><option value="">선택</option>{data.drivers.map((d)=><option key={d.id} value={d.name}>{d.name}</option>)}</select></div><div className="form-group"><label>살포기사</label><select value={txForm.sprayDriver} onChange={(e)=>setTxForm({...txForm,sprayDriver:e.target.value})}><option value="">선택</option>{data.drivers.map((d)=><option key={d.id} value={d.name}>{d.name}</option>)}</select></div></div><div className="card" style={{padding:12,marginBottom:12}}><h3 style={{marginTop:0}}>품목 라인</h3>{lineItems.map((line,idx)=><div key={idx} className="line-box"><div className="form-row"><div className="form-group"><label>품목</label><select value={line.itemId} onChange={(e)=>selectItemForLine(idx,e.target.value)}><option value="">선택</option>{data.items.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="form-group"><label>수량</label><input type="number" value={line.qty} onChange={(e)=>updateLine(idx,{qty:e.target.value})} /></div></div><div className="form-row"><div className="form-group"><label>단가</label><input type="number" value={line.unitPrice} onChange={(e)=>updateLine(idx,{unitPrice:e.target.value})} /></div><div className="form-group"><label>할인유형</label><select value={line.discountType} onChange={(e)=>updateLine(idx,{discountType:e.target.value})}><option>없음</option><option>금액</option><option>%</option></select></div></div><div className="form-row"><div className="form-group"><label>할인값</label><input type="number" value={line.discountValue} onChange={(e)=>updateLine(idx,{discountValue:e.target.value})} /></div><div className="form-group"><label>공급금액</label><input value={fc(calcLine(line))} readOnly /></div></div><button className="ghost small-btn" onClick={()=>removeLine(idx)}>라인 삭제</button></div>)}<button className="secondary small-btn" onClick={addLine}>라인 추가</button></div><div className="form-row"><div className="form-group"><label>살포비 총액</label><input type="number" value={txForm.sprayCost} onChange={(e)=>setTxForm({...txForm,sprayCost:e.target.value})} /></div><div className="form-group"><label>당일수금</label><input type="number" value={txForm.paid} onChange={(e)=>setTxForm({...txForm,paid:e.target.value})} /></div></div><div className="form-group"><label>메모</label><textarea value={txForm.memo} onChange={(e)=>setTxForm({...txForm,memo:e.target.value})} /></div><button onClick={addTransaction}>출고 저장</button></div><div className="card"><h3>출고 내역</h3><div className="table-wrap"><table><thead><tr><th>날짜</th><th>농가</th><th>검수처</th><th className="right">총금액</th><th className="right">살포비</th><th>상태</th></tr></thead><tbody>{data.transactions.map((tx)=><tr key={tx.id}><td>{tx.date}</td><td>{partnerMap[tx.partnerId]?.name || "-"}</td><td>{partnerMap[tx.inspectionOrgId]?.name || "-"}</td><td className="right">{fc(tx.totalAmount)}</td><td className="right">{fc(tx.sprayCost)}</td><td><span className="badge">{tx.inspectionStatus}</span></td></tr>)}</tbody></table></div></div></div>}

      {tab === "receivables" && <div className="two-col"><div className="card"><h3>수금 등록</h3><div className="form-row"><div className="form-group"><label>날짜</label><input type="date" value={receiptForm.date} onChange={(e)=>setReceiptForm({...receiptForm,date:e.target.value})} /></div><div className="form-group"><label>농가</label><select value={receiptForm.partnerId} onChange={(e)=>setReceiptForm({...receiptForm,partnerId:e.target.value})}><option value="">선택</option>{data.partners.filter((p)=>p.type==="농가").map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div><div className="form-group"><label>입금액</label><input type="number" value={receiptForm.amount} onChange={(e)=>setReceiptForm({...receiptForm,amount:e.target.value})} /></div><div className="form-group"><label>메모</label><textarea value={receiptForm.memo} onChange={(e)=>setReceiptForm({...receiptForm,memo:e.target.value})} /></div><button onClick={addReceipt}>수금 저장</button></div><div className="card"><h3>미수 현황</h3><div className="table-wrap"><table><thead><tr><th>농가</th><th className="right">총출고</th><th className="right">총수금</th><th className="right">미수금</th></tr></thead><tbody>{receivableRows.map((r)=><tr key={r.partnerId}><td>{r.name}</td><td className="right">{fc(r.sales)}</td><td className="right">{fc(r.paid)}</td><td className="right">{fc(r.balance)}</td></tr>)}</tbody></table></div></div></div>}

      {tab === "inspections" && <div className="card"><h3>검수 관리</h3><div className="table-wrap"><table><thead><tr><th>날짜</th><th>농가</th><th>검수처</th><th className="right">총금액</th><th>상태</th><th>품목</th></tr></thead><tbody>{data.transactions.map((tx)=><tr key={tx.id}><td>{tx.date}</td><td>{partnerMap[tx.partnerId]?.name || "-"}</td><td>{partnerMap[tx.inspectionOrgId]?.name || "-"}</td><td className="right">{fc(tx.totalAmount)}</td><td><span className="badge">{tx.inspectionStatus}</span></td><td className="small">{tx.lines.map((l)=>`${l.itemName} ${l.qty}${itemMap[l.itemId]?.unit || ""}`).join(", ")}</td></tr>)}</tbody></table></div></div>}
    </div>
  );
}
