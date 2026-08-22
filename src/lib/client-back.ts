// 应用内「返回」辅助(4.15):应用内导航(顶栏/站内链接)→ history.back() 回上一页;
// 直接打开(外链/新标签,无应用内历史)→ 回指定兜底页,避免把用户带出应用。
// 依据:pushState 不改变 document.referrer —— 首载来源可稳定区分:空 = 直接打开本应用;跨源 = 外链进入。
type BackRouter = {
  back: () => void;
  replace: (href: string) => void;
};

export function goBackOrFallback(router: BackRouter, fallback: string) {
  if (window.history.length <= 1) {
    router.replace(fallback);
    return;
  }
  const referrer = document.referrer;
  let sameOrigin = !referrer;
  if (referrer) {
    try {
      sameOrigin = new URL(referrer).origin === window.location.origin;
    } catch {
      sameOrigin = false;
    }
  }
  if (sameOrigin) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
