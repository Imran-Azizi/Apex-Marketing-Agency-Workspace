/**
 * Template-based recommendation copy (fallback when AI is unavailable).
 */

import { stageLabel } from '../crm/pipeline.js';
import { CATEGORY_LABELS, KINDS, KIND_LABELS } from './constants.js';

function clip(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function composeRecommendation(signal, context) {
  const name = context.personName || 'مشتری';
  const stage = stageLabel(context.pipelineStage);
  const days = Math.round((Number(context.daysInStage) || 0) * 10) / 10;
  const kindLabel = KIND_LABELS[signal.kind] || 'توصیه فروش';

  if (signal.kind === KINDS.DEPOSIT_FOLLOW_UP) {
    return {
      title: `${kindLabel} — ${name}`,
      reason: `مشتری ${days} روز در مرحله «${stage}» مانده و هنوز بیعانه تأییدشده ثبت نشده است.`,
      whatHappened: `پس از تأیید سفارش، پرداخت بیعانه در سیستم ثبت یا تأیید نشده است.`,
      customerWants: signal.lastCustomerText
        ? `آخرین پیام مشتری: «${clip(signal.lastCustomerText, 160)}»`
        : 'پیام اخیر مشتری در پرونده ثبت نشده است.',
      whatsStopping: signal.objections?.length
        ? `مانع احتمالی: ${signal.objections.join('، ')}`
        : 'احتمالاً نیاز به یادآوری روش پرداخت یا رفع ابهام مالی دارد.',
      recommendedAction:
        `امروز با ${name} تماس بگیرید، روش پرداخت بیعانه را یادآوری کنید، و در صورت نیاز لینک یا شماره حساب را دوباره ارسال کنید.`,
      suggestedMessage:
        `سلام ${name} عزیز، امیدوارم حالتان خوب باشد. برای شروع پروژه، ثبت بیعانه لازم است. اگر سؤالی دارید یا به راهنمایی برای پرداخت نیاز دارید، خوشحال می‌شوم کمک کنم.`,
      salesApproach: 'لحن محترمانه، کوتاه، و متمرکز بر گام بعدی (پرداخت بیعانه).',
      closeHelp: 'پس از پرداخت، رسید را در CRM ثبت کنید تا مرحله به‌صورت خودکار جلو برود.',
    };
  }

  if (signal.kind === KINDS.REPEAT_ORDER) {
    const project = context.orders?.lastProjectTitle || 'پروژه قبلی';
    return {
      title: `${kindLabel} — ${name}`,
      reason: `از آخرین تحویل حدود ${Math.round(context.orders?.daysSinceLastDelivered || 0)} روز گذشته و چرخه فروش باز جدیدی ندارد.`,
      whatHappened: `آخرین پروژه: «${clip(project, 120)}».`,
      customerWants: 'احتمالاً به محتوای جدید یا کمپین فصلی نیاز دارد.',
      whatsStopping: 'تماس پیش‌دستانه انجام نشده است.',
      recommendedAction:
        `این هفته با ${name} تماس بگیرید و پکیج جدید، نمونه‌کار مرتبط، یا پیشنهاد سفارش تکراری را مطرح کنید.`,
      suggestedMessage:
        `سلام ${name} عزیز، امیدوارم از ${clip(project, 80)} راضی بوده باشید. اگر برای ویدیوی جدید یا کمپین بعدی برنامه دارید، خوشحال می‌شوم گزینه‌های مناسب را پیشنهاد دهم.`,
      salesApproach: 'تمرکز بر رابطه قبلی و ارزش افزوده؛ بدون فشار بیش از حد.',
      closeHelp: 'در صورت علاقه، فرصت جدید در CRM باز کنید.',
    };
  }

  // Default: decision waiting follow-up
  return {
    title: `${kindLabel} — ${name}`,
    reason: `مشتری ${days} روز در مرحله «${stage}» مانده و پیشرفت معنادار جدیدی ثبت نشده است.`,
    whatHappened: signal.lastSalesText
      ? `آخرین اقدام فروش: «${clip(signal.lastSalesText, 160)}»`
      : 'اقدام اخیر فروش در پرونده ثبت نشده است.',
    customerWants: signal.lastCustomerText
      ? `آخرین پیام مشتری: «${clip(signal.lastCustomerText, 160)}»`
      : 'پاسخ اخیر مشتری ثبت نشده است.',
    whatsStopping: signal.objections?.length
      ? `مانع احتمالی: ${signal.objections.join('، ')}`
      : 'احتمالاً نیاز به پیگیری ملایم و پاسخ به ابهامات دارد.',
    recommendedAction:
      `امروز یا حداکثر تا ۴۸ ساعت آینده با ${name} تماس بگیرید، وضعیت تصمیم درباره سفارش را بپرسید، و یک گام مشخص (مثلاً تماس کوتاه یا ارسال نمونه) پیشنهاد دهید.`,
    suggestedMessage:
      `سلام ${name} عزیز، درباره پیشنهاد قبلی اگر سؤالی دارید خوشحال می‌شوم پاسخ دهم. اگر مایل باشید می‌توانیم یک جلسه کوتاه برای نهایی‌کردن جزئیات هماهنگ کنیم.`,
    salesApproach: 'پرسش باز + پیشنهاد گام بعدی مشخص؛ بدون تکرار پیام‌های قبلی.',
    closeHelp: 'پس از پاسخ مشتری، وضعیت CRM را به‌روز کنید.',
  };
}

export function categoryLabelForSignal(signal) {
  if (signal.kind === KINDS.DEPOSIT_FOLLOW_UP) return CATEGORY_LABELS.DEPOSIT;
  if (signal.kind === KINDS.REPEAT_ORDER) return CATEGORY_LABELS.REPEAT;
  return CATEGORY_LABELS.DECISION;
}
