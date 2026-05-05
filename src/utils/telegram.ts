declare global {
  interface Window {
    Telegram?: any;
  }
}

export function getTelegramUid(): string {
  const tg = window.Telegram?.WebApp;

  if (tg?.initDataUnsafe?.user?.id) {
    return String(tg.initDataUnsafe.user.id);
  }

  // fallback для локальной разработки
  return "test_user2";
}
