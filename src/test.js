const e=require('./engine.js');
const base={age:'u30',monthly:250000,bonus:500000,tenure:'1_5y',reason:'self',savings:1500000,severance:0,rent:70000,living:120000,health:'kokuho',leaveYear:2026,leaveMonth:12,pensionExempt:false};
for (const [name,o] of [['自己都合',{}],['会社都合',{reason:'company'}],['資格なし(自己都合半年〜1年)',{tenure:'6m_1y'}],['3月退職',{leaveYear:2027,leaveMonth:3}]]) {
  const r=e.simulate(base,{override:o});
  console.log(name,'months',r.months,'end',r.endYear+'/'+r.endMonth,'plan',JSON.stringify(r.plan),'lump',r.lump);
  console.log(r.rows.slice(0,6).map(x=>`${x.y}/${x.m} +${x.benefit} 住${x.jumin} 保${x.health} 年${x.pension} 残${x.balance}`).join('\n'));
}
console.log('日額 25万:',e.benefitDaily(250000,'u30'),' 40万:',e.benefitDaily(400000,'u30'),' 15万:',e.benefitDaily(150000,'u30'));
console.log('住民税 350万:',e.juminzeiAnnual(3500000),' 国保:',e.kokuhoAnnual(3500000,false),' 軽減:',e.kokuhoAnnual(3500000,true));
