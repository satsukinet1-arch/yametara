// 「辞めたら何ヶ月暮らせる？」計算エンジン
// 毎年変わる数字は CONFIG にまとめる（年度ごとに更新）
const CONFIG = {
  // 雇用保険 基本手当（令和8年8月1日〜）厚生労働省
  benefit: {
    wageDailyMin: 3203,
    dailyMin: 2562,
    rate80Below: 5480,   // この賃金日額未満は80%
    rate50Above: 13490,  // この賃金日額超は50%
    // 年齢区分ごとの賃金日額上限・基本手当日額上限
    caps: {
      u30: { wage: 14900, daily: 7450 },
      a30_34: { wage: 16540, daily: 8270 },
      a35_44: { wage: 16540, daily: 8270 },
      a45_59: { wage: 18220, daily: 9110 },
    },
    restrictionMonthsSelf: 1, // 自己都合の給付制限（2025年4月〜原則1ヶ月）
  },
  // 国民年金 定額保険料（日本年金機構）
  pension: { byFiscalYear: { 2026: 17920, 2027: 18290 }, fallback: 18290 },
  // 国保（全国の目安。自治体で大きく異なる）
  kokuho: { incomeRate: 0.10, perCapita: 50000, cap: 920000, basicDeduction: 430000 },
  // 任意継続（協会けんぽの目安）
  ninkei: { rate: 0.10, stdCap: 320000 },
  // 住民税
  juminzei: { rate: 0.10, perCapita: 5000, basicDeduction: 430000, socialInsRate: 0.15 },
};

// 所定給付日数（会社都合＝特定受給資格者）
const DAYS_COMPANY = {
  //       半年未満, 半年〜1年, 1〜5年, 5〜10年, 10〜20年, 20年以上
  u30:    [0, 90, 90, 120, 180, 180],
  a30_34: [0, 90, 120, 180, 210, 240],
  a35_44: [0, 90, 150, 180, 240, 270],
  a45_59: [0, 90, 180, 240, 270, 330],
};
// 一般（自己都合・契約満了は安全側で一般の日数）
const DAYS_GENERAL = [0, 0, 90, 90, 120, 150]; // 1年未満は自己都合だと資格なし

const TENURE = ['lt6m', '6m_1y', '1_5y', '5_10y', '10_20y', 'ge20y'];

function kyuyoShotoku(income) {
  // 給与所得控除（令和7年分以降）
  let ded;
  if (income <= 1900000) ded = 650000;
  else if (income <= 3600000) ded = income * 0.3 + 80000;
  else if (income <= 6600000) ded = income * 0.2 + 440000;
  else if (income <= 8500000) ded = income * 0.1 + 1100000;
  else ded = 1950000;
  return Math.max(0, income - ded);
}

function juminzeiAnnual(income) {
  if (income <= 0) return 0;
  const c = CONFIG.juminzei;
  const base = kyuyoShotoku(income) - income * c.socialInsRate - c.basicDeduction;
  if (kyuyoShotoku(income) <= 450000) return 0; // 非課税の目安（単身）
  return Math.max(0, Math.floor(base * c.rate)) + c.perCapita;
}

function kokuhoAnnual(income, reduce30) {
  const c = CONFIG.kokuho;
  let shotoku = kyuyoShotoku(income);
  if (reduce30) shotoku *= 0.3;
  const base = Math.max(0, shotoku - c.basicDeduction);
  let perCapita = c.perCapita;
  if (shotoku <= c.basicDeduction) perCapita *= 0.3; // 7割軽減の目安
  return Math.min(c.cap, Math.floor(base * c.incomeRate + perCapita));
}

function benefitDaily(monthly, ageKey) {
  const b = CONFIG.benefit;
  const cap = b.caps[ageKey];
  let w = (monthly * 6) / 180;
  w = Math.max(b.wageDailyMin, Math.min(w, cap.wage));
  let y;
  if (w < b.rate80Below) y = 0.8 * w;
  else if (w <= b.rate50Above) y = 0.8 * w - 0.3 * ((w - b.rate80Below) / (b.rate50Above - b.rate80Below)) * w;
  else y = 0.5 * w;
  return Math.floor(Math.max(b.dailyMin, Math.min(y, cap.daily)));
}

function benefitPlan(inp) {
  const t = TENURE.indexOf(inp.tenure);
  let days = 0, eligible = true, startMonth = 2;
  if (inp.reason === 'company') {
    days = DAYS_COMPANY[inp.age][t];
  } else if (inp.reason === 'contract') {
    days = t >= 1 ? Math.max(90, DAYS_GENERAL[t]) : 0;
  } else {
    days = DAYS_GENERAL[t];
    startMonth = 2 + CONFIG.benefit.restrictionMonthsSelf;
  }
  if (!days) eligible = false;
  const daily = eligible ? benefitDaily(inp.monthly, inp.age) : 0;
  return { eligible, days, daily, startMonth, total: daily * days };
}

// y年m月（1-12）の年度（6月始まり＝住民税年度）
function taxYearOf(y, m) { return m >= 6 ? y : y - 1; }
function fiscalYearOf(y, m) { return m >= 4 ? y : y - 1; }
function addMonth(y, m, k) { const t = y * 12 + (m - 1) + k; return [Math.floor(t / 12), (t % 12) + 1]; }

function simulate(raw, opt = {}) {
  const inp = Object.assign({}, raw, opt.override || {});
  const annualIncome = inp.monthly * 12 + inp.bonus;
  const [LY, LM] = [inp.leaveYear, inp.leaveMonth];
  const incomeOfYear = (y) => {
    if (y < LY) return annualIncome;
    if (y === LY) return inp.monthly * LM + inp.bonus * (LM / 12);
    return 0;
  };
  const isInvoluntary = inp.reason === 'company' || inp.reason === 'contract';
  const reduceEndFY = fiscalYearOf(LY, LM) + 1; // 翌年度末まで

  const plan = benefitPlan(inp);
  let remainingDays = plan.days;

  // 住民税：1〜4月退職は5月分まで一括天引き
  let lump = 0;
  if (LM >= 1 && LM <= 4) {
    lump = Math.round(juminzeiAnnual(incomeOfYear(LY - 1)) / 12 * (5 - LM));
  }
  let balance = inp.savings + inp.severance - lump;
  const start = balance;

  const rows = [];
  let months = null, exact = null;
  const MAX = 60;
  for (let k = 1; k <= MAX; k++) {
    const [y, m] = addMonth(LY, LM, k);
    const ty = taxYearOf(y, m);
    // 住民税（一括で払った月は0）
    let jumin = 0;
    const coveredByLump = LM <= 4 && y === LY && m <= 5;
    if (!coveredByLump) jumin = juminzeiAnnual(incomeOfYear(ty - 1)) / 12;
    // 健康保険
    let health = 0;
    const kokuho = () => {
      const fy = fiscalYearOf(y, m);
      const reduce = isInvoluntary && fy <= reduceEndFY;
      return kokuhoAnnual(incomeOfYear(ty - 1), reduce) / 12;
    };
    const ninkei = () => (k <= 24 ? Math.min(inp.monthly, CONFIG.ninkei.stdCap) * CONFIG.ninkei.rate : kokuho());
    const hType = inp.health === 'unknown' ? 'kokuho' : inp.health;
    if (hType === 'kokuho') health = kokuho();
    else if (hType === 'ninkei') health = ninkei();
    else if (hType === 'cheapest') health = Math.min(kokuho(), ninkei());
    else health = 0; // 扶養
    // 国民年金
    const fyP = fiscalYearOf(y, m);
    const pension = inp.pensionExempt ? 0 : (CONFIG.pension.byFiscalYear[fyP] || CONFIG.pension.fallback);
    // 失業手当
    let benefit = 0;
    if (plan.eligible && k >= plan.startMonth && remainingDays > 0) {
      const d = Math.min(28, remainingDays);
      benefit = plan.daily * d;
      remainingDays -= d;
    }
    const out = inp.rent + inp.living + jumin + health + pension;
    const prev = balance;
    balance += benefit - out;
    rows.push({ y, m, benefit: Math.round(benefit), jumin: Math.round(jumin), health: Math.round(health), pension, out: Math.round(out), balance: Math.round(balance) });
    if (balance < 0 && months === null) { months = k - 1; exact = prev > 0 ? (k - 1) + prev / (prev - balance) : k - 1; }
  }
  if (months === null) { months = MAX; exact = MAX; }
  const [ey, em] = addMonth(LY, LM, months);
  return { months, exact, endYear: ey, endMonth: em, plan, lump, start, rows, capped: months >= MAX };
}

if (typeof module !== 'undefined') module.exports = { simulate, benefitDaily, juminzeiAnnual, kokuhoAnnual, kyuyoShotoku, CONFIG };
