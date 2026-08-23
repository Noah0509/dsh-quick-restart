// dsh-quick-restart 网页客户端
//   - 侧边栏脚注「重启」按钮（宽栏文字 + 图标，窄栏仅图标）
//   - 设置页「快速重启」卡片（服务状态 + 重启按钮）
//   - 重启中原生接管页面：旋转动画 + 阶段文案 + 进度条，恢复后自动刷新
// 手写 CommonJS + React.createElement，无需构建步骤：
// 直接以 window.__ModuleLoader__.load({ id, factory }) 注册，
// 与 dsh-session-manager 的客户端使用同一套加载协议。
window.__ModuleLoader__.load({
  id: 'dsh-quick-restart',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useCallback = React.useCallback;

    var CHANNEL = '/dsh-quick-restart';
    var E = {
      restart: 'server.restart',
      status: 'server.status',
    };

    // 与 dsh-session-manager 一致的官方设计系统变量
    var styles = {
      card: { background: 'var(--dsw-alias-bg-layer-1,#fff)', border: '1px solid var(--dsw-alias-border-l2,#e5e7eb)', borderRadius: 12, padding: '16px 20px', maxWidth: 720 },
      title: { fontSize: 14, fontWeight: 600, color: 'var(--dsw-alias-label-primary,inherit)', marginBottom: 8 },
      muted: { color: 'var(--dsw-alias-label-tertiary,#8b93a1)', fontSize: 12, lineHeight: 1.6, marginBottom: 12 },
      metaBox: { background: 'var(--dsw-alias-bg-layer-2,#f7f8fa)', border: '1px solid var(--dsw-alias-border-l2,#e5e7eb)', borderRadius: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary,#4b5563)', wordBreak: 'break-all', marginBottom: 12 },
      btn: { font: 'inherit', cursor: 'pointer', border: '1px solid var(--dsw-alias-button-ghost-active-border, var(--dsw-alias-border-l2,#d1d5db))', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)', height: 28, padding: '0 12px', borderRadius: 999, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 },
      btnDanger: { color: '#dc2626', borderColor: 'rgba(220,38,38,.35)' },
      btnPrimary: { background: 'var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary,#4f6ef7))', color: 'var(--dsw-alias-label-primary-foreground, #fff)', border: 'none', height: 28, padding: '0 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer' },
      btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
      footerBtnWide: { font: 'inherit', cursor: 'pointer', border: '1px solid var(--dsw-alias-button-ghost-active-border, var(--dsw-alias-border-l2,#d1d5db))', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)', height: 32, padding: '0 14px', borderRadius: 999, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 },
      footerBtnRail: { font: 'inherit', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-secondary,#4b5563)', width: 36, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
      footerBtnLabel: { fontSize: 12 },
      overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
      dialog: { background: 'var(--dsw-alias-bg-layer-1,#fff)', border: '1px solid var(--dsw-alias-border-l2,#e5e7eb)', borderRadius: 12, padding: '20px', maxWidth: 420, width: '90%' },
      dialogTitle: { fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--dsw-alias-label-primary,inherit)' },
      dialogBody: { fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary,#4b5563)', marginBottom: 16, wordBreak: 'break-all' },
      dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
      notice: { fontSize: 12, lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, margin: '8px 0' },
      noticeOk: { background: 'var(--dsw-alias-state-success-soft,#e7f6ec)', color: 'var(--dsw-alias-state-success-primary,#16a34a)' },
      noticeError: { background: 'rgba(220,38,38,.08)', color: '#dc2626' },
    };

    /** 旋转箭头图标（SVG，跟随 currentColor）。 */
    function RestartIcon(props) {
      var size = props.size || 14;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { flexShrink: 0 },
        'aria-hidden': 'true',
      },
        h('path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }),
        h('path', { d: 'M21 3v5h-5' }),
      );
    }

    /** 确认弹窗。 */
    function ConfirmDialog(props) {
      return h('div', { style: styles.overlay, onClick: props.onCancel },
        h('div', { style: styles.dialog, onClick: function (e) { e.stopPropagation(); } },
          h('div', { style: styles.dialogTitle }, props.title),
          h('div', { style: styles.dialogBody }, props.body),
          h('div', { style: styles.dialogActions },
            h('button', { style: styles.btn, onClick: props.onCancel }, '取消'),
            h('button', {
              style: Object.assign({}, styles.btn, styles.btnDanger),
              disabled: !!props.busy,
              onClick: props.onConfirm,
            }, props.busy ? '重启中…' : (props.confirmText || '确认重启')),
          ),
        ),
      );
    }

    /** 重启中遮罩。 */
    function RestartingOverlay() {
      return h('div', { style: styles.overlay },
        h('div', { style: styles.dialog },
          h('div', { style: styles.dialogTitle }, '正在重启 DSH 服务…'),
          h('div', { style: styles.dialogBody }, '服务进程将以相同命令重新启动。页面将在服务恢复后自动刷新；若长时间无响应，请手动刷新。'),
        ),
      );
    }

    /**
     * 轮询服务恢复（降级路径：原生重启页构建失败时使用）。
     * 必须先观察到一次连接失败（确认旧进程退出），再等恢复，避免把
     * 退出宽限期内仍在线的旧服务误判为「已恢复」而过早刷新。
     * @param seenDown - 是否已观察到服务下线。
     * @param attempt - 当前尝试次数（从 0 开始）。
     */
    function pollUntilUp(seenDown, attempt) {
      fetch(window.location.origin + '/', { method: 'GET', cache: 'no-store' })
        .then(function () {
          if (!seenDown) { setTimeout(function () { pollUntilUp(false, attempt + 1); }, 200); return; }
          window.location.reload();
        })
        .catch(function () {
          if (attempt > 120) { window.location.reload(); return; }
          setTimeout(function () { pollUntilUp(true, attempt + 1); }, 1000);
        });
    }

    // 多标签页同步：任一标签发起重启，其余标签同步进入重启屏
    // （BroadcastChannel 不会收到自己发的消息，无需过滤发送者）
    var bc = null;
    try { bc = new BroadcastChannel('dsh-quick-restart'); } catch (e) { /* 不支持则各标签独立 */ }
    if (bc) {
      bc.onmessage = function (ev) {
        if (ev && ev.data === 'restarting') enterRestartScreen();
      };
    }
    var broadcastRestart = function () {
      try { if (bc) bc.postMessage('restarting'); } catch (e) { /* 广播失败不影响本标签 */ }
    };

    /** 读取当前页面底色并判断明暗，让重启页与应用主题一致。 */
    function readTheme() {
      try {
        var parse = function (color) {
          var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '');
          if (!m) return null;
          return { color: color, dark: (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) < 128 };
        };
        var fromBody = parse(getComputedStyle(document.body).backgroundColor);
        var fromHtml = parse(getComputedStyle(document.documentElement).backgroundColor);
        if (fromBody && fromBody.color !== 'rgba(0, 0, 0, 0)') return fromBody;
        if (fromHtml && fromHtml.color !== 'rgba(0, 0, 0, 0)') return fromHtml;
      } catch (e) { /* 读取失败用浅色兜底 */ }
      return { color: '#ffffff', dark: false };
    }

    /**
     * 原生重启页：确认重启后脱离 React，直接重建 document。
     * - 旋转动画 + 阶段文案（停止旧进程 → 启动新进程 → 等待就绪）+ 进度条；
     * - 旧文档连同应用样式一起移除，框架断连遮罩无法再干扰此页面；
     * - 恢复后带 restarted=1 刷新，页面加载完展示「重启完成」提示；
     * - 标签页标题同步显示「⟳ 重启中…」。
     */
    function enterRestartScreen() {
      try {
        var theme = readTheme();
        var sub = theme.dark ? '#9ca3af' : '#6b7280';
        var track = theme.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)';
        var border = theme.dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.18)';
        var css = [
          '@keyframes dqr-rot { to { transform: rotate(360deg); } }',
          '.dqr-body { margin: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; font: 14px/1.6 system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }',
          '.dqr-spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid ' + track + '; border-top-color: #4f6ef7; animation: dqr-rot .8s linear infinite; }',
          '.dqr-title { font-size: 15px; font-weight: 600; }',
          '.dqr-sub { font-size: 13px; }',
          '.dqr-track { width: 220px; height: 6px; border-radius: 999px; background: ' + track + '; overflow: hidden; }',
          '.dqr-bar { height: 100%; width: 0%; border-radius: 999px; background: #4f6ef7; transition: width .3s ease; }',
          '.dqr-btn { display: none; margin-top: 4px; font: inherit; font-size: 13px; cursor: pointer; height: 30px; padding: 0 16px; border-radius: 999px; background: transparent; }',
        ].join('\n');
        // 清空旧文档（应用样式与脚本一并移除），原生重建
        var rootEl = document.documentElement;
        while (rootEl.firstChild) rootEl.removeChild(rootEl.firstChild);
        var headEl = document.createElement('head');
        var styleEl = document.createElement('style');
        styleEl.textContent = css;
        headEl.appendChild(styleEl);
        var titleEl = document.createElement('title');
        titleEl.textContent = '⟳ 重启中…';
        headEl.appendChild(titleEl);
        var bodyEl = document.createElement('body');
        bodyEl.className = 'dqr-body';
        bodyEl.style.background = theme.color;
        bodyEl.style.color = theme.dark ? '#e5e7eb' : '#374151';
        bodyEl.innerHTML =
          '<div class="dqr-spin" id="dqr-spin"></div>' +
          '<div class="dqr-title">正在重启 DSH 服务…</div>' +
          '<div class="dqr-sub" id="dqr-phase" aria-live="polite" style="color:' + sub + '">正在停止旧进程…</div>' +
          '<div class="dqr-track"><div class="dqr-bar" id="dqr-bar"></div></div>' +
          '<div class="dqr-sub" id="dqr-elapsed" style="color:' + sub + '"></div>' +
          '<button type="button" class="dqr-btn" id="dqr-btn" style="border:1px solid ' + border + '">刷新页面</button>';
        rootEl.appendChild(headEl);
        rootEl.appendChild(bodyEl);
        runRestartPoll(window.location.origin, {
          spin: document.getElementById('dqr-spin'),
          phase: document.getElementById('dqr-phase'),
          bar: document.getElementById('dqr-bar'),
          elapsed: document.getElementById('dqr-elapsed'),
          btn: document.getElementById('dqr-btn'),
        });
      } catch (e) {
        // 原生页构建失败（几乎不可能）：退回简单轮询刷新
        pollUntilUp(false, 0);
      }
    }

    /**
     * 重启页轮询状态机：stopping（等服务下线）→ starting（等服务恢复）→ up。
     * 必须先观察到一次连接失败，才能确认旧进程真的退出，避免把退出
     * 宽限期内仍在线的旧服务误判为「已恢复」而过早刷新页面。
     */
    function runRestartPoll(origin, els) {
      var start = Date.now();
      var downAt = 0; // 首次探测到服务下线的时刻
      var upSince = 0; // 本轮连续在线的起点（0 = 当前离线）
      var state = 'stopping';
      var stopped = false;
      var ui = null;
      // 判定「真正恢复」所需的连续在线时长（毫秒）
      var STABLE_MS = 8000;

      var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      // 实测：启动早期存在「TCP 已连但 HTTP 不响应」的静默阶段，
      // fetch 不带超时会挂在静默 socket 上，轮询停摆，必须加超时。
      var probe = function () {
        var opts = { method: 'GET', cache: 'no-store' };
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
          opts.signal = AbortSignal.timeout(1500);
        }
        return fetch(origin + '/', opts)
          .then(function () { return true; })
          .catch(function () { return false; });
      };
      var setPhase = function (text) { els.phase.textContent = text; };

      var finish = function () {
        stopped = true;
        clearInterval(ui);
        setPhase('重启完成，正在刷新页面…');
        els.bar.style.width = '100%';
        setTimeout(function () {
          try {
            var url = new URL(window.location.href);
            url.searchParams.set('restarted', '1');
            window.history.replaceState(null, '', url.href);
          } catch (e) { /* URL 处理失败则按原地址刷新 */ }
          window.location.reload();
        }, 150);
      };

      var giveUp = function (kind) {
        stopped = true;
        clearInterval(ui);
        els.spin.style.display = 'none';
        els.phase.style.color = '#dc2626';
        if (kind === 'not-sent') {
          setPhase('重启请求可能未送达，服务仍在运行。');
          els.btn.textContent = '返回重试';
        } else {
          setPhase(downAt
            ? '服务长时间未恢复，请手动刷新或稍后重试。'
            : '服务持续在线，本次重启可能未生效。');
        }
        els.btn.style.display = 'inline-flex';
        els.btn.onclick = function () { window.location.reload(); };
      };

      // UI 心跳：计时 + 进度条（前 30 秒推进到 80%，之后悬停等真实恢复）
      ui = setInterval(function () {
        if (stopped) return;
        var el = (Date.now() - start) / 1000;
        els.elapsed.textContent = el > 30
          ? '已等待 ' + Math.floor(el) + ' 秒 · 比预期慢，仍在等待服务就绪…'
          : '已等待 ' + Math.floor(el) + ' 秒';
        els.bar.style.width = Math.min(80, (el / 30) * 80).toFixed(1) + '%';
        if (state === 'starting') {
          if (upSince) setPhase('服务已恢复，正在确认连接稳定…');
          else setPhase((Date.now() - downAt) < 1500 ? '正在启动新进程…' : '等待服务就绪…');
        }
      }, 250);

      (async function loop() {
        while (!stopped && Date.now() - start < 180000) {
          var up = await probe();
          if (state === 'stopping') {
            // 服务迟迟未下线：重启请求多半没送达，别让用户白等
            if (Date.now() - start > 10000) { giveUp('not-sent'); return; }
            if (up) { await sleep(200); continue; }
            state = 'starting';
            downAt = Date.now();
            continue;
          }
          // 实测：启动中途存在约数秒的「短暂 HTTP 200 窗口」随后再次下线，
          // 必须持续在线满 STABLE_MS 才判定真正恢复，避免刷新进半死的页面。
          if (up) {
            if (!upSince) upSince = Date.now();
            if (Date.now() - upSince >= STABLE_MS) { finish(); return; }
            await sleep(400);
            continue;
          }
          upSince = 0;
          await sleep(400);
        }
        if (!stopped) giveUp('timeout');
      })();
    }

    /** 重启完成提示：带 restarted=1 的刷新完成后展示 toast 并清理 URL。 */
    function showRestartedToast() {
      try {
        var url = new URL(window.location.href);
        if (url.searchParams.get('restarted') !== '1') return;
        url.searchParams.delete('restarted');
        window.history.replaceState(null, '', url.href);
        var toast = document.createElement('div');
        toast.textContent = '重启完成';
        toast.setAttribute('style', 'position:fixed;left:50%;transform:translateX(-50%);bottom:28px;z-index:10000;padding:8px 16px;border-radius:999px;font-size:13px;background:var(--dsw-alias-state-success-soft,#e7f6ec);color:var(--dsw-alias-state-success-primary,#16a34a);box-shadow:0 4px 14px rgba(0,0,0,.12);transition:opacity .4s;opacity:1');
        document.body.appendChild(toast);
        setTimeout(function () { toast.style.opacity = '0'; }, 2600);
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3100);
      } catch (e) { /* 提示失败不影响功能 */ }
    }

    /** 共享的重启状态机（侧边栏按钮与设置卡片复用）。 */
    function useRestartFlow(rpcCall) {
      var phaseState = useState('idle'); // idle | confirm | restarting | error
      var phase = phaseState[0];
      var setPhase = phaseState[1];
      var noticeState = useState(null);
      var notice = noticeState[0];
      var setNotice = noticeState[1];

      var start = useCallback(function () { setNotice(null); setPhase('confirm'); }, []);
      var cancel = useCallback(function () { setPhase('idle'); }, []);
      var confirm = useCallback(function () {
        setPhase('restarting');
        setNotice(null);
        rpcCall(E.restart, {}).then(function (res) {
          if (res && res.ok === false) {
            // 服务端明确拒绝（进程仍在运行）：保留页面并提示
            setPhase('error');
            setNotice('重启失败：' + String((res.error && res.error.message) || '请求被拒绝'));
            return;
          }
          // 通知其他标签页，本标签切换到原生重启页
          broadcastRestart();
          enterRestartScreen();
        }).catch(function () {
          // 网络层失败多半意味着服务已进入退出流程：同样交给原生重启页轮询
          broadcastRestart();
          enterRestartScreen();
        });
      }, [rpcCall]);

      return { phase: phase, notice: notice, start: start, cancel: cancel, confirm: confirm };
    }

    /** 侧边栏脚注「重启」按钮（sidebar.footer.action 槽）。 */
    function FooterRestartAction(props) {
      // props: { wide, rpcCall }
      var flow = useRestartFlow(props.rpcCall);
      var icon = h(RestartIcon, { size: props.wide ? 14 : 16 });
      var btn = h('button', {
        type: 'button',
        style: props.wide ? styles.footerBtnWide : styles.footerBtnRail,
        title: '重启 DSH 服务',
        'aria-label': '重启 DSH 服务',
        onClick: flow.start,
      }, icon, props.wide ? h('span', { style: styles.footerBtnLabel }, '重启') : null);

      if (flow.phase === 'confirm') {
        return h('div', null,
          btn,
          h(ConfirmDialog, {
            title: '重启 DSH 服务？',
            body: '服务进程将被终止并以相同命令重新启动。正在进行的对话与任务会被中断，页面将在服务恢复后自动刷新。',
            confirmText: '重启',
            onCancel: flow.cancel,
            onConfirm: flow.confirm,
          }),
        );
      }
      if (flow.phase === 'restarting') return h('div', null, btn, h(RestartingOverlay, {}));
      return btn;
    }

    /** 设置页「快速重启」卡片（settings.section 槽）。 */
    function SettingsQuickRestart(props) {
      // props: { rpcCall, close }
      var flow = useRestartFlow(props.rpcCall);
      var statusState = useState(null);
      var status = statusState[0];
      var setStatus = statusState[1];

      var loadStatus = useCallback(function () {
        props.rpcCall(E.status, {}).then(function (res) {
          if (!res || !res.ok) return;
          setStatus(res.value);
        }).catch(function () { /* 状态读取失败忽略 */ });
      }, [props.rpcCall]);

      useEffect(function () { loadStatus(); }, [loadStatus]);

      return h('div', { style: styles.card },
        h('div', { style: styles.title }, '快速重启'),
        h('div', { style: styles.muted }, '重启 DSH 服务进程（改完配置后快速生效）。正在进行的对话与任务会被中断，页面在服务恢复后自动刷新。'),
        status !== null ? h('div', { style: styles.metaBox },
          'PID：' + String(status.pid || ''),
          status.restarting ? h('div', { style: Object.assign({}, styles.notice, styles.noticeOk) }, '重启已在进行中…') : null,
        ) : null,
        flow.notice ? h('div', {
          style: Object.assign({}, styles.notice, flow.phase === 'error' ? styles.noticeError : styles.noticeOk),
        }, flow.notice) : null,
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('button', {
            style: Object.assign({}, styles.btn, styles.btnDanger),
            disabled: flow.phase === 'restarting',
            onClick: flow.start,
          }, flow.phase === 'restarting' ? '重启中…' : '重启服务'),
          flow.phase !== 'idle' && flow.phase !== 'restarting'
            ? h('button', { style: styles.btn, onClick: flow.cancel }, '取消')
            : null,
        ),
        flow.phase === 'confirm' ? h(ConfirmDialog, {
          title: '重启 DSH 服务？',
          body: '服务进程将被终止并以相同命令重新启动。正在进行的对话与任务会被中断，页面将在服务恢复后自动刷新。',
          confirmText: '重启',
          busy: false,
          onCancel: flow.cancel,
          onConfirm: flow.confirm,
        }) : null,
        flow.phase === 'restarting' ? h(RestartingOverlay, {}) : null,
      );
    }

    function apply(ctx) {
      var rpcCall = function (endpoint, payload) {
        return ctx.connection.rpc.call(CHANNEL, endpoint, payload);
      };
      // 侧边栏脚注「重启」按钮（与设置按钮同排）
      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'quick-restart',
          order: 1,
          inject: function () { return { rpcCall: rpcCall }; },
        }, FooterRestartAction);
      });
      // 设置页「快速重启」卡片
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({
          name: 'settings.section',
          id: 'quick-restart',
          order: 9,
          label: function () { return '快速重启'; },
          inject: function () { return { rpcCall: rpcCall }; },
        }, SettingsQuickRestart);
      });
    }

    // 页面加载时检查 restarted 标记：清理 URL 并展示「重启完成」toast
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showRestartedToast);
    } else {
      showRestartedToast();
    }

    module.exports = { name: 'dsh-quick-restart', inject: ['slots', 'connection'], apply };
    return module.exports;
  },
});
