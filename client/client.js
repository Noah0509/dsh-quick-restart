// dsh-quick-restart 网页客户端
//   - 侧边栏脚注「重启」按钮（宽栏文字 + 图标，窄栏仅图标）
//   - 设置页「快速重启」卡片（服务状态 + 重启按钮）
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
     * 轮询服务恢复：重启期间 fetch 会短暂失败（连接被拒），成功后刷新页面。
     * @param attempt - 当前尝试次数（从 0 开始）。
     * @param onGiveUp - 超过上限后的回调。
     */
    function pollUntilUp(attempt, onGiveUp) {
      fetch(window.location.origin + '/', { method: 'GET', cache: 'no-store' })
        .then(function () { window.location.reload(); })
        .catch(function () {
          if (attempt > 60) { onGiveUp(); return; }
          setTimeout(function () { pollUntilUp(attempt + 1, onGiveUp); }, 2000);
        });
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
          if (!res || !res.ok) throw new Error((res && res.error && res.error.message) || '重启请求失败');
          // 服务即将断开；轮询恢复后自动刷新页面
          pollUntilUp(0, function () {
            setPhase('error');
            setNotice('服务长时间未恢复，请手动刷新页面。');
          });
        }).catch(function (err) {
          setPhase('error');
          setNotice('重启失败：' + String(err && err.message ? err.message : err));
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

    module.exports = { name: 'dsh-quick-restart', inject: ['slots', 'connection'], apply };
    return module.exports;
  },
});
