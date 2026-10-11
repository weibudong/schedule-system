function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function today() {
  return formatDate(new Date());
}

function formatAmount(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('zh-CN');
}

// 生成某月的 42 个日历格（周一开头），与 web 端逻辑一致
function buildMonthDays(year, month /* 0-based */) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  const startPadding = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = startPadding; i > 0; i--) {
    const d = new Date(year, month, -i + 1);
    days.push({ date: d.getDate(), fullDate: formatDate(d), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: i,
      fullDate: year + '-' + pad2(month + 1) + '-' + pad2(i),
      isCurrentMonth: true,
    });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d.getDate(), fullDate: formatDate(d), isCurrentMonth: false });
  }
  return days;
}

function periodWeight(p) {
  return p === '上午' ? 0 : p === '下午' ? 1 : 2;
}

module.exports = { pad2, formatDate, today, formatAmount, buildMonthDays, periodWeight };
