import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ClipboardCheck,
  Code2,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Image,
  Info,
  KeyRound,
  LucideIcon,
  Maximize2,
  MessageSquare,
  Mic,
  Minimize2,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Square,
  SquarePen,
  SquarePlus,
  Store,
  Terminal,
  UserRound,
  Workflow,
  X
} from "lucide-react";
import { WorkspaceIDE } from "./components/IDE/WorkspaceIDE";
import { MessageList } from "./components/chat/MessageList";
import logoUrl from "../assets/fiitx-logo.png";

const PRODUCT_NAME = "Fiitx";
const PRODUCT_EYEBROW = "Fiitx BYOM Agent Desktop";
const PRODUCT_SUBTITLE = "Enterprise Agent";
const I18N_STORAGE_KEY = "fiitx.uiLocale";

type UiLocale = "en" | "zh" | "zh-TW" | "hi" | "es" | "fr" | "ar" | "bn" | "pt" | "id" | "ur" | "ru";

const supportedLocales: Array<{ id: UiLocale; nativeName: string; englishName: string; dir: "ltr" | "rtl" }> = [
  { id: "en", nativeName: "English", englishName: "English", dir: "ltr" },
  { id: "zh", nativeName: "中文", englishName: "Chinese", dir: "ltr" },
  { id: "zh-TW", nativeName: "繁體中文", englishName: "Traditional Chinese", dir: "ltr" },
  { id: "hi", nativeName: "हिन्दी", englishName: "Hindi", dir: "ltr" },
  { id: "es", nativeName: "Español", englishName: "Spanish", dir: "ltr" },
  { id: "fr", nativeName: "Français", englishName: "French", dir: "ltr" },
  { id: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl" },
  { id: "bn", nativeName: "বাংলা", englishName: "Bengali", dir: "ltr" },
  { id: "pt", nativeName: "Português", englishName: "Portuguese", dir: "ltr" },
  { id: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", dir: "ltr" },
  { id: "ur", nativeName: "اردو", englishName: "Urdu", dir: "rtl" },
  { id: "ru", nativeName: "Русский", englishName: "Russian", dir: "ltr" }
];

const i18n: Record<UiLocale, Record<string, string>> = {
  en: {
    "product.subtitle": "Enterprise Agent",
    "sidebar.newTask": "New task",
    "sidebar.projects": "Projects",
    "sidebar.settings": "Settings",
    "workspace.choose": "Choose workspace",
    "action.refresh": "Refresh status",
    "action.addAttachment": "Add attachment",
    "action.voiceInput": "Voice input",
    "action.stopTask": "Stop current task",
    "action.stopping": "Stopping",
    "action.sendTask": "Send task",
    "action.sendSteer": "Send update",
    "pane.sidebar.collapse": "Collapse left navigation",
    "pane.sidebar.expand": "Expand left navigation",
    "pane.right.collapse": "Collapse right panel",
    "pane.right.expand": "Expand right panel",
    "composer.currentChannel": "Current channel: {name}",
    "composer.placeholder": "Type a message or task",
    "permissions.ask": "Request approval",
    "permissions.auto": "Auto-approve",
    "permissions.full": "Full access",
    "status.running": "Running",
    "status.waiting": "Pending approval",
    "status.done": "Completed",
    "settings.group": "Settings",
    "settings.back": "Back to app",
    "settings.eyebrow": "Settings",
    "settings.fallbackTitle": "Settings",
    "settings.fallbackDesc": "Fiitx configuration",
    "settings.language": "Language",
    "settings.languageHelp": "Defaults to your system language. You can override it here.",
    "nav.agents": "Agent",
    "nav.approvals": "Approvals",
    "nav.history": "History",
    "nav.audit": "Audit",
    "nav.policy": "Policy",
    "nav.models": "Model Marketplace",
    "nav.mcp": "MCP",
    "nav.skills": "Skill",
    "nav.about": "General",
    "nav.agents.desc": "Business agents, channels, evals",
    "nav.approvals.desc": "Permission queue and releases",
    "nav.history.desc": "Traces, versions, reviews",
    "nav.audit.desc": "Security and operation logs",
    "nav.policy.desc": "Tools, sandbox, default permissions",
    "nav.models.desc": "Providers, profiles, routing",
    "nav.mcp.desc": "External tools and data sources",
    "nav.skills.desc": "Task capability extensions",
    "nav.about.desc": "Language, version, local state",
    "about.eyebrow": "General",
    "about.copy1": "Fiitx is a BYOM Agent Desktop for enterprise and professional workflows, bringing model profiles, agent orchestration, approval policy, execution history, audit logs and local workspace operations into one desktop workbench.",
    "about.copy2": "Its goal is to close the loop across Chat, Coding, Artifacts, MCP/Skill extensions and safety policy: tasks execute, processes are traceable, and outcomes can be reviewed.",
    "about.platform": "Platform",
    "about.version": "Version",
    "about.secureStorage": "Secure storage",
    "about.workspace": "Current workspace",
    "about.keychainAvailable": "Keychain available",
    "about.keychainUnavailable": "Local encryption unavailable",
    "about.notSelected": "Not selected",
    "terminal.new": "New terminal",
    "terminal.close": "Close Terminal",
    "terminal.empty": "Run commands in the current workspace for builds, scripts and file checks.",
    "terminal.running": "Running"
  },
  zh: {
    "product.subtitle": "Enterprise Agent",
    "sidebar.newTask": "新建任务",
    "sidebar.projects": "项目",
    "sidebar.settings": "设置",
    "workspace.choose": "选择工作区",
    "action.refresh": "刷新状态",
    "action.addAttachment": "添加附件",
    "action.voiceInput": "语音输入",
    "action.stopTask": "停止当前任务",
    "action.stopping": "正在停止",
    "action.sendTask": "发送任务",
    "action.sendSteer": "发送中途补充",
    "pane.sidebar.collapse": "收起左侧导航",
    "pane.sidebar.expand": "展开左侧导航",
    "pane.right.collapse": "收起右侧面板",
    "pane.right.expand": "展开右侧面板",
    "composer.currentChannel": "当前通道：{name}",
    "composer.placeholder": "输入消息或任务",
    "permissions.ask": "请求批准",
    "permissions.auto": "替我审批",
    "permissions.full": "完全访问权限",
    "status.running": "运行中",
    "status.waiting": "待审批",
    "status.done": "已完成",
    "settings.group": "Settings",
    "settings.back": "Back to app",
    "settings.eyebrow": "Settings",
    "settings.fallbackTitle": "设置",
    "settings.fallbackDesc": "Fiitx 配置",
    "settings.language": "界面语言",
    "settings.languageHelp": "默认跟随系统语言，也可以在这里手动覆盖。",
    "nav.agents": "Agent",
    "nav.approvals": "审批",
    "nav.history": "历史",
    "nav.audit": "审计",
    "nav.policy": "策略",
    "nav.models": "模型广场",
    "nav.mcp": "MCP",
    "nav.skills": "Skill",
    "nav.about": "General",
    "nav.agents.desc": "业务 Agent、通道、评测",
    "nav.approvals.desc": "权限队列与放行",
    "nav.history.desc": "Trace、版本、复盘",
    "nav.audit.desc": "安全与操作日志",
    "nav.policy.desc": "工具、沙箱、默认权限",
    "nav.models.desc": "Provider、Profile、路由",
    "nav.mcp.desc": "外部工具与数据源",
    "nav.skills.desc": "任务能力扩展",
    "nav.about.desc": "语言、版本与本机信息",
    "about.eyebrow": "General",
    "about.copy1": "Fiitx 是面向企业与专业工作流的 BYOM Agent Desktop，用于把模型配置、Agent 编排、审批策略、执行历史、审计记录和本地工作区操作放在同一个桌面工作台里。",
    "about.copy2": "它的目标是让 Chat、Coding、Artifact、MCP/Skill 扩展和安全策略形成闭环：任务能执行，过程可追踪，结果可复盘。",
    "about.platform": "平台",
    "about.version": "版本",
    "about.secureStorage": "安全存储",
    "about.workspace": "当前工作区",
    "about.keychainAvailable": "Keychain 可用",
    "about.keychainUnavailable": "本地加密不可用",
    "about.notSelected": "未选择",
    "terminal.new": "新建终端",
    "terminal.close": "关闭 Terminal",
    "terminal.empty": "在当前工作区执行命令，适合运行构建、脚本和文件检查。",
    "terminal.running": "执行中"
  },
  "zh-TW": {
    "product.subtitle": "Enterprise Agent",
    "sidebar.newTask": "新增任務",
    "sidebar.projects": "專案",
    "sidebar.settings": "設定",
    "workspace.choose": "選擇工作區",
    "action.refresh": "重新整理狀態",
    "action.addAttachment": "新增附件",
    "action.voiceInput": "語音輸入",
    "action.stopTask": "停止目前任務",
    "action.stopping": "正在停止",
    "action.sendTask": "送出任務",
    "action.sendSteer": "送出補充",
    "pane.sidebar.collapse": "收合左側導覽",
    "pane.sidebar.expand": "展開左側導覽",
    "pane.right.collapse": "收合右側面板",
    "pane.right.expand": "展開右側面板",
    "composer.currentChannel": "目前通道：{name}",
    "composer.placeholder": "輸入訊息或任務",
    "permissions.ask": "請求核准",
    "permissions.auto": "替我核准",
    "permissions.full": "完整存取權限",
    "status.running": "執行中",
    "status.waiting": "待核准",
    "status.done": "已完成",
    "settings.group": "Settings",
    "settings.back": "Back to app",
    "settings.eyebrow": "Settings",
    "settings.fallbackTitle": "設定",
    "settings.fallbackDesc": "Fiitx 設定",
    "settings.language": "介面語言",
    "settings.languageHelp": "預設跟隨系統語言，也可以在這裡手動覆寫。",
    "nav.agents": "Agent",
    "nav.approvals": "核准",
    "nav.history": "歷史",
    "nav.audit": "稽核",
    "nav.policy": "策略",
    "nav.models": "模型廣場",
    "nav.mcp": "MCP",
    "nav.skills": "Skill",
    "nav.about": "General",
    "nav.agents.desc": "業務 Agent、通道、評測",
    "nav.approvals.desc": "權限佇列與放行",
    "nav.history.desc": "Trace、版本、復盤",
    "nav.audit.desc": "安全與操作記錄",
    "nav.policy.desc": "工具、沙箱、預設權限",
    "nav.models.desc": "Provider、Profile、路由",
    "nav.mcp.desc": "外部工具與資料來源",
    "nav.skills.desc": "任務能力擴充",
    "nav.about.desc": "語言、版本與本機資訊",
    "about.eyebrow": "General",
    "about.copy1": "Fiitx 是面向企業與專業工作流的 BYOM Agent Desktop，用於把模型設定、Agent 編排、核准策略、執行歷史、稽核記錄和本地工作區操作放在同一個桌面工作台裡。",
    "about.copy2": "它的目標是讓 Chat、Coding、Artifact、MCP/Skill 擴充和安全策略形成閉環：任務能執行，過程可追蹤，結果可復盤。",
    "about.platform": "平台",
    "about.version": "版本",
    "about.secureStorage": "安全儲存",
    "about.workspace": "目前工作區",
    "about.keychainAvailable": "Keychain 可用",
    "about.keychainUnavailable": "本機加密不可用",
    "about.notSelected": "未選擇",
    "terminal.new": "新增終端機",
    "terminal.close": "關閉 Terminal",
    "terminal.empty": "在目前工作區執行命令，適合執行建置、腳本和檔案檢查。",
    "terminal.running": "執行中"
  },
  hi: {
    "product.subtitle": "Enterprise Agent", "sidebar.newTask": "नया कार्य", "sidebar.projects": "प्रोजेक्ट", "sidebar.settings": "सेटिंग्स", "workspace.choose": "वर्कस्पेस चुनें", "action.refresh": "स्थिति रीफ्रेश करें", "action.addAttachment": "अटैचमेंट जोड़ें", "action.voiceInput": "वॉइस इनपुट", "action.stopTask": "वर्तमान कार्य रोकें", "action.stopping": "रोका जा रहा है", "action.sendTask": "कार्य भेजें", "action.sendSteer": "अपडेट भेजें", "pane.sidebar.collapse": "बायां नेविगेशन समेटें", "pane.sidebar.expand": "बायां नेविगेशन खोलें", "pane.right.collapse": "दायां पैनल समेटें", "pane.right.expand": "दायां पैनल खोलें", "composer.currentChannel": "वर्तमान चैनल: {name}", "composer.placeholder": "संदेश या कार्य लिखें", "permissions.ask": "अनुमोदन मांगें", "permissions.auto": "स्वतः अनुमोदन", "permissions.full": "पूर्ण पहुंच", "status.running": "चल रहा है", "status.waiting": "अनुमोदन लंबित", "status.done": "पूर्ण", "settings.group": "सेटिंग्स", "settings.back": "ऐप पर लौटें", "settings.eyebrow": "सेटिंग्स", "settings.fallbackTitle": "सेटिंग्स", "settings.fallbackDesc": "Fiitx कॉन्फ़िगरेशन", "settings.language": "भाषा", "settings.languageHelp": "डिफ़ॉल्ट सिस्टम भाषा है। आप इसे यहां बदल सकते हैं.", "nav.agents": "Agent", "nav.approvals": "अनुमोदन", "nav.history": "इतिहास", "nav.audit": "ऑडिट", "nav.policy": "नीति", "nav.models": "मॉडल मार्केट", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "व्यावसायिक agents, चैनल, evals", "nav.approvals.desc": "अनुमति कतार और रिलीज़", "nav.history.desc": "Trace, संस्करण, समीक्षा", "nav.audit.desc": "सुरक्षा और ऑपरेशन लॉग", "nav.policy.desc": "टूल, sandbox, डिफ़ॉल्ट अनुमति", "nav.models.desc": "Provider, profile, routing", "nav.mcp.desc": "बाहरी टूल और डेटा स्रोत", "nav.skills.desc": "कार्य क्षमता विस्तार", "nav.about.desc": "संस्करण और स्थानीय स्थिति", "about.eyebrow": "General", "about.copy1": "Fiitx enterprise और professional workflows के लिए BYOM Agent Desktop है।", "about.copy2": "यह Chat, Coding, Artifacts, MCP/Skill और safety policy को एक traceable loop में जोड़ता है।", "about.platform": "प्लेटफॉर्म", "about.version": "संस्करण", "about.secureStorage": "सुरक्षित संग्रहण", "about.workspace": "वर्तमान वर्कस्पेस", "about.keychainAvailable": "Keychain उपलब्ध", "about.keychainUnavailable": "स्थानीय encryption उपलब्ध नहीं", "about.notSelected": "चयनित नहीं", "terminal.new": "नया टर्मिनल", "terminal.close": "Terminal बंद करें", "terminal.empty": "वर्तमान workspace में build, script और file check के लिए command चलाएं.", "terminal.running": "चल रहा है"
  },
  es: {
    "product.subtitle": "Agente empresarial", "sidebar.newTask": "Nueva tarea", "sidebar.projects": "Proyectos", "sidebar.settings": "Ajustes", "workspace.choose": "Elegir espacio de trabajo", "action.refresh": "Actualizar estado", "action.addAttachment": "Añadir adjunto", "action.voiceInput": "Entrada de voz", "action.stopTask": "Detener tarea actual", "action.stopping": "Deteniendo", "action.sendTask": "Enviar tarea", "action.sendSteer": "Enviar actualización", "pane.sidebar.collapse": "Contraer navegación izquierda", "pane.sidebar.expand": "Expandir navegación izquierda", "pane.right.collapse": "Contraer panel derecho", "pane.right.expand": "Expandir panel derecho", "composer.currentChannel": "Canal actual: {name}", "composer.placeholder": "Escribe un mensaje o tarea", "permissions.ask": "Solicitar aprobación", "permissions.auto": "Autoaprobar", "permissions.full": "Acceso total", "status.running": "En ejecución", "status.waiting": "Pendiente de aprobación", "status.done": "Completado", "settings.group": "Ajustes", "settings.back": "Volver a la app", "settings.eyebrow": "Ajustes", "settings.fallbackTitle": "Ajustes", "settings.fallbackDesc": "Configuración de Fiitx", "settings.language": "Idioma", "settings.languageHelp": "Por defecto usa el idioma del sistema. Puedes cambiarlo aquí.", "nav.agents": "Agent", "nav.approvals": "Aprobaciones", "nav.history": "Historial", "nav.audit": "Auditoría", "nav.policy": "Política", "nav.models": "Mercado de modelos", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "Agents, canales y evaluaciones", "nav.approvals.desc": "Cola de permisos", "nav.history.desc": "Trazas, versiones y revisiones", "nav.audit.desc": "Registros de seguridad", "nav.policy.desc": "Herramientas, sandbox y permisos", "nav.models.desc": "Proveedores, perfiles y routing", "nav.mcp.desc": "Herramientas y datos externos", "nav.skills.desc": "Extensiones de capacidades", "nav.about.desc": "Versión y estado local", "about.eyebrow": "General", "about.copy1": "Fiitx es un BYOM Agent Desktop para flujos empresariales y profesionales.", "about.copy2": "Conecta Chat, Coding, Artifacts, MCP/Skill y políticas de seguridad en un flujo auditable.", "about.platform": "Plataforma", "about.version": "Versión", "about.secureStorage": "Almacenamiento seguro", "about.workspace": "Workspace actual", "about.keychainAvailable": "Keychain disponible", "about.keychainUnavailable": "Cifrado local no disponible", "about.notSelected": "No seleccionado", "terminal.new": "Nuevo terminal", "terminal.close": "Cerrar Terminal", "terminal.empty": "Ejecuta comandos en el workspace actual para builds, scripts y comprobaciones.", "terminal.running": "Ejecutando"
  },
  fr: {
    "product.subtitle": "Agent d'entreprise", "sidebar.newTask": "Nouvelle tâche", "sidebar.projects": "Projets", "sidebar.settings": "Paramètres", "workspace.choose": "Choisir l'espace de travail", "action.refresh": "Actualiser l'état", "action.addAttachment": "Ajouter une pièce jointe", "action.voiceInput": "Entrée vocale", "action.stopTask": "Arrêter la tâche", "action.stopping": "Arrêt en cours", "action.sendTask": "Envoyer la tâche", "action.sendSteer": "Envoyer la mise à jour", "pane.sidebar.collapse": "Réduire la navigation gauche", "pane.sidebar.expand": "Afficher la navigation gauche", "pane.right.collapse": "Réduire le panneau droit", "pane.right.expand": "Afficher le panneau droit", "composer.currentChannel": "Canal actuel : {name}", "composer.placeholder": "Saisir un message ou une tâche", "permissions.ask": "Demander l'approbation", "permissions.auto": "Approuver automatiquement", "permissions.full": "Accès complet", "status.running": "En cours", "status.waiting": "En attente d'approbation", "status.done": "Terminé", "settings.group": "Paramètres", "settings.back": "Retour à l'app", "settings.eyebrow": "Paramètres", "settings.fallbackTitle": "Paramètres", "settings.fallbackDesc": "Configuration Fiitx", "settings.language": "Langue", "settings.languageHelp": "Par défaut, la langue du système est utilisée. Vous pouvez la modifier ici.", "nav.agents": "Agent", "nav.approvals": "Approbations", "nav.history": "Historique", "nav.audit": "Audit", "nav.policy": "Politique", "nav.models": "Marché des modèles", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "Agents métier, canaux, évaluations", "nav.approvals.desc": "File des autorisations", "nav.history.desc": "Traces, versions, revues", "nav.audit.desc": "Journaux de sécurité", "nav.policy.desc": "Outils, sandbox, permissions", "nav.models.desc": "Providers, profils, routage", "nav.mcp.desc": "Outils et données externes", "nav.skills.desc": "Extensions de capacités", "nav.about.desc": "Version et état local", "about.eyebrow": "General", "about.copy1": "Fiitx est un BYOM Agent Desktop pour les workflows professionnels et d'entreprise.", "about.copy2": "Il relie Chat, Coding, Artifacts, MCP/Skill et les politiques de sécurité dans une boucle traçable.", "about.platform": "Plateforme", "about.version": "Version", "about.secureStorage": "Stockage sécurisé", "about.workspace": "Workspace actuel", "about.keychainAvailable": "Keychain disponible", "about.keychainUnavailable": "Chiffrement local indisponible", "about.notSelected": "Non sélectionné", "terminal.new": "Nouveau terminal", "terminal.close": "Fermer Terminal", "terminal.empty": "Exécutez des commandes dans le workspace actuel pour builds, scripts et contrôles.", "terminal.running": "En cours"
  },
  ar: {
    "product.subtitle": "وكيل مؤسسي", "sidebar.newTask": "مهمة جديدة", "sidebar.projects": "المشاريع", "sidebar.settings": "الإعدادات", "workspace.choose": "اختر مساحة العمل", "action.refresh": "تحديث الحالة", "action.addAttachment": "إضافة مرفق", "action.voiceInput": "إدخال صوتي", "action.stopTask": "إيقاف المهمة الحالية", "action.stopping": "جار الإيقاف", "action.sendTask": "إرسال المهمة", "action.sendSteer": "إرسال تحديث", "pane.sidebar.collapse": "طي التنقل الأيسر", "pane.sidebar.expand": "توسيع التنقل الأيسر", "pane.right.collapse": "طي اللوحة اليمنى", "pane.right.expand": "توسيع اللوحة اليمنى", "composer.currentChannel": "القناة الحالية: {name}", "composer.placeholder": "اكتب رسالة أو مهمة", "permissions.ask": "طلب موافقة", "permissions.auto": "موافقة تلقائية", "permissions.full": "وصول كامل", "status.running": "قيد التشغيل", "status.waiting": "بانتظار الموافقة", "status.done": "مكتمل", "settings.group": "الإعدادات", "settings.back": "العودة إلى التطبيق", "settings.eyebrow": "الإعدادات", "settings.fallbackTitle": "الإعدادات", "settings.fallbackDesc": "إعداد Fiitx", "settings.language": "اللغة", "settings.languageHelp": "الافتراضي هو لغة النظام. يمكنك تغييرها هنا.", "nav.agents": "Agent", "nav.approvals": "الموافقات", "nav.history": "السجل", "nav.audit": "التدقيق", "nav.policy": "السياسة", "nav.models": "سوق النماذج", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "Agents وقنوات وتقييمات", "nav.approvals.desc": "قائمة الأذونات", "nav.history.desc": "Traces وإصدارات ومراجعات", "nav.audit.desc": "سجلات الأمان", "nav.policy.desc": "أدوات و sandbox وأذونات", "nav.models.desc": "Providers و profiles و routing", "nav.mcp.desc": "أدوات ومصادر بيانات خارجية", "nav.skills.desc": "توسعات قدرات المهام", "nav.about.desc": "الإصدار والحالة المحلية", "about.eyebrow": "General", "about.copy1": "Fiitx هو BYOM Agent Desktop لسير العمل المؤسسي والمهني.", "about.copy2": "يربط Chat و Coding و Artifacts و MCP/Skill وسياسات الأمان ضمن حلقة قابلة للتتبع.", "about.platform": "النظام", "about.version": "الإصدار", "about.secureStorage": "تخزين آمن", "about.workspace": "مساحة العمل الحالية", "about.keychainAvailable": "Keychain متاح", "about.keychainUnavailable": "التشفير المحلي غير متاح", "about.notSelected": "غير محدد", "terminal.new": "Terminal جديد", "terminal.close": "إغلاق Terminal", "terminal.empty": "شغّل الأوامر في مساحة العمل الحالية للبناء وال scripts وفحص الملفات.", "terminal.running": "قيد التشغيل"
  },
  bn: {
    "product.subtitle": "এন্টারপ্রাইজ এজেন্ট", "sidebar.newTask": "নতুন কাজ", "sidebar.projects": "প্রকল্প", "sidebar.settings": "সেটিংস", "workspace.choose": "ওয়ার্কস্পেস বেছে নিন", "action.refresh": "স্ট্যাটাস রিফ্রেশ", "action.addAttachment": "সংযুক্তি যোগ করুন", "action.voiceInput": "ভয়েস ইনপুট", "action.stopTask": "বর্তমান কাজ থামান", "action.stopping": "থামছে", "action.sendTask": "কাজ পাঠান", "action.sendSteer": "আপডেট পাঠান", "pane.sidebar.collapse": "বাম নেভিগেশন গুটান", "pane.sidebar.expand": "বাম নেভিগেশন খুলুন", "pane.right.collapse": "ডান প্যানেল গুটান", "pane.right.expand": "ডান প্যানেল খুলুন", "composer.currentChannel": "বর্তমান চ্যানেল: {name}", "composer.placeholder": "বার্তা বা কাজ লিখুন", "permissions.ask": "অনুমোদন চান", "permissions.auto": "স্বয়ংক্রিয় অনুমোদন", "permissions.full": "সম্পূর্ণ অ্যাক্সেস", "status.running": "চলছে", "status.waiting": "অনুমোদনের অপেক্ষায়", "status.done": "সম্পন্ন", "settings.group": "সেটিংস", "settings.back": "অ্যাপে ফিরুন", "settings.eyebrow": "সেটিংস", "settings.fallbackTitle": "সেটিংস", "settings.fallbackDesc": "Fiitx কনফিগারেশন", "settings.language": "ভাষা", "settings.languageHelp": "ডিফল্টভাবে সিস্টেম ভাষা ব্যবহার হয়। এখানে বদলাতে পারেন.", "nav.agents": "Agent", "nav.approvals": "অনুমোদন", "nav.history": "ইতিহাস", "nav.audit": "অডিট", "nav.policy": "নীতি", "nav.models": "মডেল মার্কেট", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "ব্যবসায়িক agents, চ্যানেল, evals", "nav.approvals.desc": "অনুমতি queue", "nav.history.desc": "Trace, version, review", "nav.audit.desc": "সিকিউরিটি লগ", "nav.policy.desc": "Tools, sandbox, permission", "nav.models.desc": "Providers, profiles, routing", "nav.mcp.desc": "বাহ্যিক tools ও data", "nav.skills.desc": "কাজের ক্ষমতা সম্প্রসারণ", "nav.about.desc": "ভার্সন ও লোকাল স্টেট", "about.eyebrow": "General", "about.copy1": "Fiitx enterprise ও professional workflow এর জন্য BYOM Agent Desktop.", "about.copy2": "এটি Chat, Coding, Artifacts, MCP/Skill এবং safety policy কে traceable loop এ যুক্ত করে.", "about.platform": "প্ল্যাটফর্ম", "about.version": "ভার্সন", "about.secureStorage": "নিরাপদ স্টোরেজ", "about.workspace": "বর্তমান workspace", "about.keychainAvailable": "Keychain আছে", "about.keychainUnavailable": "Local encryption নেই", "about.notSelected": "নির্বাচিত নয়", "terminal.new": "নতুন terminal", "terminal.close": "Terminal বন্ধ করুন", "terminal.empty": "বর্তমান workspace এ build, script ও file check এর command চালান.", "terminal.running": "চলছে"
  },
  ru: {
    "product.subtitle": "Корпоративный агент", "sidebar.newTask": "Новая задача", "sidebar.projects": "Проекты", "sidebar.settings": "Настройки", "workspace.choose": "Выбрать рабочую область", "action.refresh": "Обновить статус", "action.addAttachment": "Добавить файл", "action.voiceInput": "Голосовой ввод", "action.stopTask": "Остановить задачу", "action.stopping": "Остановка", "action.sendTask": "Отправить задачу", "action.sendSteer": "Отправить обновление", "pane.sidebar.collapse": "Свернуть левую навигацию", "pane.sidebar.expand": "Развернуть левую навигацию", "pane.right.collapse": "Свернуть правую панель", "pane.right.expand": "Развернуть правую панель", "composer.currentChannel": "Текущий канал: {name}", "composer.placeholder": "Введите сообщение или задачу", "permissions.ask": "Запросить одобрение", "permissions.auto": "Автоодобрение", "permissions.full": "Полный доступ", "status.running": "Выполняется", "status.waiting": "Ожидает одобрения", "status.done": "Готово", "settings.group": "Настройки", "settings.back": "Назад в приложение", "settings.eyebrow": "Настройки", "settings.fallbackTitle": "Настройки", "settings.fallbackDesc": "Конфигурация Fiitx", "settings.language": "Язык", "settings.languageHelp": "По умолчанию используется язык системы. Здесь можно изменить.", "nav.agents": "Agent", "nav.approvals": "Одобрения", "nav.history": "История", "nav.audit": "Аудит", "nav.policy": "Политика", "nav.models": "Маркет моделей", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "Бизнес agents, каналы, evals", "nav.approvals.desc": "Очередь разрешений", "nav.history.desc": "Traces, версии, разбор", "nav.audit.desc": "Логи безопасности", "nav.policy.desc": "Tools, sandbox, permissions", "nav.models.desc": "Providers, profiles, routing", "nav.mcp.desc": "Внешние tools и data", "nav.skills.desc": "Расширения возможностей", "nav.about.desc": "Версия и локальное состояние", "about.eyebrow": "General", "about.copy1": "Fiitx — BYOM Agent Desktop для корпоративных и профессиональных workflow.", "about.copy2": "Он связывает Chat, Coding, Artifacts, MCP/Skill и политики безопасности в отслеживаемый цикл.", "about.platform": "Платформа", "about.version": "Версия", "about.secureStorage": "Безопасное хранилище", "about.workspace": "Текущий workspace", "about.keychainAvailable": "Keychain доступен", "about.keychainUnavailable": "Локальное шифрование недоступно", "about.notSelected": "Не выбрано", "terminal.new": "Новый terminal", "terminal.close": "Закрыть Terminal", "terminal.empty": "Выполняйте команды в текущем workspace для builds, scripts и проверки файлов.", "terminal.running": "Выполняется"
  },
  pt: {
    "product.subtitle": "Agente empresarial", "sidebar.newTask": "Nova tarefa", "sidebar.projects": "Projetos", "sidebar.settings": "Configurações", "workspace.choose": "Escolher workspace", "action.refresh": "Atualizar status", "action.addAttachment": "Adicionar anexo", "action.voiceInput": "Entrada de voz", "action.stopTask": "Parar tarefa atual", "action.stopping": "Parando", "action.sendTask": "Enviar tarefa", "action.sendSteer": "Enviar atualização", "pane.sidebar.collapse": "Recolher navegação esquerda", "pane.sidebar.expand": "Expandir navegação esquerda", "pane.right.collapse": "Recolher painel direito", "pane.right.expand": "Expandir painel direito", "composer.currentChannel": "Canal atual: {name}", "composer.placeholder": "Digite uma mensagem ou tarefa", "permissions.ask": "Solicitar aprovação", "permissions.auto": "Aprovar automaticamente", "permissions.full": "Acesso total", "status.running": "Em execução", "status.waiting": "Aguardando aprovação", "status.done": "Concluído", "settings.group": "Configurações", "settings.back": "Voltar ao app", "settings.eyebrow": "Configurações", "settings.fallbackTitle": "Configurações", "settings.fallbackDesc": "Configuração do Fiitx", "settings.language": "Idioma", "settings.languageHelp": "Por padrão usa o idioma do sistema. Você pode alterar aqui.", "nav.agents": "Agent", "nav.approvals": "Aprovações", "nav.history": "Histórico", "nav.audit": "Auditoria", "nav.policy": "Política", "nav.models": "Mercado de modelos", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "Agents, canais e avaliações", "nav.approvals.desc": "Fila de permissões", "nav.history.desc": "Traces, versões e revisão", "nav.audit.desc": "Logs de segurança", "nav.policy.desc": "Ferramentas, sandbox e permissões", "nav.models.desc": "Providers, profiles e routing", "nav.mcp.desc": "Ferramentas e dados externos", "nav.skills.desc": "Extensões de capacidades", "nav.about.desc": "Versão e estado local", "about.eyebrow": "General", "about.copy1": "Fiitx é um BYOM Agent Desktop para workflows empresariais e profissionais.", "about.copy2": "Ele conecta Chat, Coding, Artifacts, MCP/Skill e políticas de segurança em um fluxo rastreável.", "about.platform": "Plataforma", "about.version": "Versão", "about.secureStorage": "Armazenamento seguro", "about.workspace": "Workspace atual", "about.keychainAvailable": "Keychain disponível", "about.keychainUnavailable": "Criptografia local indisponível", "about.notSelected": "Não selecionado", "terminal.new": "Novo terminal", "terminal.close": "Fechar Terminal", "terminal.empty": "Execute comandos no workspace atual para builds, scripts e verificações.", "terminal.running": "Executando"
  },
  id: {
    "product.subtitle": "Agen perusahaan", "sidebar.newTask": "Tugas baru", "sidebar.projects": "Proyek", "sidebar.settings": "Pengaturan", "workspace.choose": "Pilih workspace", "action.refresh": "Muat ulang status", "action.addAttachment": "Tambah lampiran", "action.voiceInput": "Input suara", "action.stopTask": "Hentikan tugas saat ini", "action.stopping": "Menghentikan", "action.sendTask": "Kirim tugas", "action.sendSteer": "Kirim pembaruan", "pane.sidebar.collapse": "Ciutkan navigasi kiri", "pane.sidebar.expand": "Bentangkan navigasi kiri", "pane.right.collapse": "Ciutkan panel kanan", "pane.right.expand": "Bentangkan panel kanan", "composer.currentChannel": "Kanal saat ini: {name}", "composer.placeholder": "Ketik pesan atau tugas", "permissions.ask": "Minta persetujuan", "permissions.auto": "Setujui otomatis", "permissions.full": "Akses penuh", "status.running": "Berjalan", "status.waiting": "Menunggu persetujuan", "status.done": "Selesai", "settings.group": "Pengaturan", "settings.back": "Kembali ke app", "settings.eyebrow": "Pengaturan", "settings.fallbackTitle": "Pengaturan", "settings.fallbackDesc": "Konfigurasi Fiitx", "settings.language": "Bahasa", "settings.languageHelp": "Default mengikuti bahasa sistem. Anda bisa mengubahnya di sini.", "nav.agents": "Agent", "nav.approvals": "Persetujuan", "nav.history": "Riwayat", "nav.audit": "Audit", "nav.policy": "Kebijakan", "nav.models": "Marketplace model", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "Agent bisnis, kanal, evaluasi", "nav.approvals.desc": "Antrean izin dan rilis", "nav.history.desc": "Trace, versi, tinjauan", "nav.audit.desc": "Log keamanan dan operasi", "nav.policy.desc": "Tools, sandbox, izin default", "nav.models.desc": "Provider, profil, routing", "nav.mcp.desc": "Tools dan sumber data eksternal", "nav.skills.desc": "Ekstensi kemampuan tugas", "nav.about.desc": "Versi, posisi, status lokal", "about.eyebrow": "General", "about.copy1": "Fiitx adalah BYOM Agent Desktop untuk workflow perusahaan dan profesional.", "about.copy2": "Fiitx menghubungkan Chat, Coding, Artifacts, MCP/Skill dan kebijakan keamanan dalam loop yang dapat ditelusuri.", "about.platform": "Platform", "about.version": "Versi", "about.secureStorage": "Penyimpanan aman", "about.workspace": "Workspace saat ini", "about.keychainAvailable": "Keychain tersedia", "about.keychainUnavailable": "Enkripsi lokal tidak tersedia", "about.notSelected": "Belum dipilih", "terminal.new": "Terminal baru", "terminal.close": "Tutup Terminal", "terminal.empty": "Jalankan command di workspace saat ini untuk build, script, dan pemeriksaan file.", "terminal.running": "Berjalan"
  },
  ur: {
    "product.subtitle": "انٹرپرائز ایجنٹ", "sidebar.newTask": "نیا کام", "sidebar.projects": "پروجیکٹس", "sidebar.settings": "ترتیبات", "workspace.choose": "ورک اسپیس منتخب کریں", "action.refresh": "حالت تازہ کریں", "action.addAttachment": "اٹیچمنٹ شامل کریں", "action.voiceInput": "آواز سے ان پٹ", "action.stopTask": "موجودہ کام روکیں", "action.stopping": "روکا جا رہا ہے", "action.sendTask": "کام بھیجیں", "action.sendSteer": "اپڈیٹ بھیجیں", "pane.sidebar.collapse": "بائیں نیویگیشن بند کریں", "pane.sidebar.expand": "بائیں نیویگیشن کھولیں", "pane.right.collapse": "دائیں پینل بند کریں", "pane.right.expand": "دائیں پینل کھولیں", "composer.currentChannel": "موجودہ چینل: {name}", "composer.placeholder": "پیغام یا کام لکھیں", "permissions.ask": "منظوری طلب کریں", "permissions.auto": "خودکار منظوری", "permissions.full": "مکمل رسائی", "status.running": "چل رہا ہے", "status.waiting": "منظوری زیر التوا", "status.done": "مکمل", "settings.group": "ترتیبات", "settings.back": "ایپ پر واپس", "settings.eyebrow": "ترتیبات", "settings.fallbackTitle": "ترتیبات", "settings.fallbackDesc": "Fiitx ترتیب", "settings.language": "زبان", "settings.languageHelp": "پہلے سے طے شدہ نظام کی زبان ہے۔ آپ یہاں بدل سکتے ہیں.", "nav.agents": "Agent", "nav.approvals": "منظوریاں", "nav.history": "تاریخ", "nav.audit": "آڈٹ", "nav.policy": "پالیسی", "nav.models": "ماڈل مارکیٹ", "nav.mcp": "MCP", "nav.skills": "Skill", "nav.about": "General", "nav.agents.desc": "Business agents، channels، evals", "nav.approvals.desc": "Permission queue", "nav.history.desc": "Trace، versions، review", "nav.audit.desc": "Security logs", "nav.policy.desc": "Tools، sandbox، permissions", "nav.models.desc": "Providers، profiles، routing", "nav.mcp.desc": "External tools and data", "nav.skills.desc": "Task capability extensions", "nav.about.desc": "Version and local state", "about.eyebrow": "General", "about.copy1": "Fiitx enterprise اور professional workflows کے لیے BYOM Agent Desktop ہے.", "about.copy2": "یہ Chat، Coding، Artifacts، MCP/Skill اور safety policy کو traceable loop میں جوڑتا ہے.", "about.platform": "پلیٹ فارم", "about.version": "ورژن", "about.secureStorage": "محفوظ اسٹوریج", "about.workspace": "موجودہ workspace", "about.keychainAvailable": "Keychain دستیاب", "about.keychainUnavailable": "Local encryption دستیاب نہیں", "about.notSelected": "منتخب نہیں", "terminal.new": "نیا terminal", "terminal.close": "Terminal بند کریں", "terminal.empty": "موجودہ workspace میں build، script اور file check commands چلائیں.", "terminal.running": "چل رہا ہے"
  }
};

function normalizeUiLocale(value?: string | null): UiLocale | null {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (/^zh[-_](tw|hk|mo|hant)/.test(normalized) || normalized === "zh-hant") {
    return "zh-TW";
  }
  const code = normalized.split(/[-_]/)[0];
  return supportedLocales.some((locale) => locale.id === code) ? code as UiLocale : null;
}

function getInitialUiLocale(): UiLocale {
  if (typeof window === "undefined") {
    return "en";
  }
  return normalizeUiLocale(window.localStorage?.getItem(I18N_STORAGE_KEY)) || normalizeUiLocale(window.navigator.language) || "en";
}

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }
  return Object.entries(values).reduce((text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)), template);
}

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("wxml", xml);

type View = "workbench" | "settings";
type SettingsPage = "agents" | "approvals" | "history" | "audit" | "policy" | "models" | "about" | "mcp" | "skills";
type ThreadStatus = "running" | "waiting" | "done";
type ApprovalStatus = "pending" | "approved" | "denied";
type ArtifactId = "report" | "ppt" | "diff" | "image";
type PanelKey = "sidebar" | "artifact" | "terminal";
type RightPaneMode = "preview" | "code";
type PermissionMode = "ask" | "auto" | "full";
type ToolPolicyMode = PermissionMode | "block";

type SettingsNavItem = {
  id: SettingsPage;
  label: string;
  description: string;
  icon: LucideIcon;
};

type SettingsNavGroup = {
  title: string;
  items: SettingsNavItem[];
};

type Thread = {
  id: string;
  title: string;
  kind: string;
  model: string;
  status: ThreadStatus;
  updatedAt: string;
  createdAt: number;
  workspacePath?: string;
  projectFolderId?: string | null;
};

type Message = {
  id: string;
  role: "user" | "agent" | "system";
  author: string;
  body: string;
  time: string;
  taskId?: string;
  streamBaseBody?: string;
  streamEvents?: FiitxAgentProgress[];
  streamStatus?: "running" | "finished";
  streamDetailsExpanded?: boolean;
  approvalId?: string;
};

type Approval = {
  id: string;
  title: string;
  detail: string;
  command: string;
  requester: string;
  risk: "low" | "medium" | "high";
  status: ApprovalStatus;
  action?: string;
  resumePayload?: FiitxAgentTaskPayload;
};

type AuditLog = {
  id: string;
  time: string;
  actor: string;
  event: string;
  target: string;
  level: "info" | "success" | "warn";
};

type AgentSpec = {
  id: string;
  name: string;
  scope: string;
  objective: string;
  systemPrompt: string;
  model: string;
  status: "ready" | "active" | "draft";
  tools: string[];
  skills: string[];
  triggers: string[];
  systems: string[];
  stages: AgentStage[];
  metrics: string[];
  channels: string[];
  policy: PermissionMode;
  accent: string;
};

type AgentStage = {
  name: string;
  owner: string;
  trigger: string;
  action: string;
  output: string;
};

type ChannelAdapterSpec = {
  id: string;
  name: string;
  channelType: "desktop-ui" | "wechat-miniprogram-ai";
  description: string;
  transport: string;
  entrypoint: string;
  sessionKeyStrategy: string;
  status: "active" | "ready" | "draft";
  capabilities: string[];
  contextSources: string[];
  outputModes: string[];
  followUpPolicy: string;
  agentBindings: string[];
  systemPrompt: string;
  sampleEvent: string;
};

type ModelForm = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  bestFor: string[];
  toolCallStyle: string;
};

type FileArtifact = {
  path: string;
  title: string;
  language: string;
  status: "modified" | "added";
  additions: number;
  deletions: number;
  preview: string;
};

type PathInfo = {
  exists: boolean;
  path: string;
  name: string;
  kind: "file" | "directory" | "other" | "missing";
  size?: number;
  extension?: string;
  previewable?: boolean;
  resolvedFromWorkspace?: boolean;
};

type TerminalEntry = {
  id: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  status: "running" | "success" | "error";
  startedAt: number;
  finishedAt?: number;
};

type ProjectFolder = {
  id: string;
  name: string;
  path?: string;
  threads: string[];
};

type ThreadRecord = {
  messages: Message[];
  progressEvents: FiitxAgentProgress[];
  artifacts: FileArtifact[];
  lastAgentArtifact: FileArtifact | null;
  executionArtifacts: FileArtifact[];
  activeAgentTaskId: string;
  executionStartedAt: number | null;
  executionFinishedAt: number | null;
  executionExpanded: boolean;
  sessionEntries: SessionEntry[];
  currentEntryId: string | null;
};

type SessionEntry = {
  id: string;
  parentId: string | null;
  kind: "message" | "progress" | "approval" | "artifact" | "tool" | "summary";
  time: string;
  payload: unknown;
};

type PolicySettings = {
  toolExecution: "sequential" | "parallel";
  sandboxMode: "read-only" | "workspace-write" | "danger-full-access";
  defaultPermissionMode: PermissionMode;
  actionModes: Record<string, ToolPolicyMode>;
};

const defaultPolicySettings: PolicySettings = {
  toolExecution: "sequential",
  sandboxMode: "workspace-write",
  defaultPermissionMode: "ask",
  actionModes: {
    "web.fetch_url": "auto",
    "workspace.scan": "ask",
    "workspace.write_manifest": "ask",
    "shell.exec": "ask",
    "network.request": "ask",
    "sensitive.read": "block"
  }
};

const DRAFT_THREAD_ID = "draft-thread";
const AUTO_MODEL = "auto";
const AUTO_MODEL_LABEL = "自动模型路由";

const settingsNavGroups: SettingsNavGroup[] = [
  {
    title: "Settings",
    items: [
      { id: "about", label: "General", description: "语言、版本与本机信息", icon: Info },
      { id: "agents", label: "Agent", description: "业务 Agent、通道、评测", icon: Bot },
      { id: "approvals", label: "审批", description: "权限队列与放行", icon: ClipboardCheck },
      { id: "history", label: "历史", description: "Trace、版本、复盘", icon: GitBranch },
      { id: "audit", label: "审计", description: "安全与操作日志", icon: Activity },
      { id: "policy", label: "策略", description: "工具、沙箱、默认权限", icon: ShieldCheck },
      { id: "models", label: "模型广场", description: "Provider、Profile、路由", icon: Brain },
      { id: "mcp", label: "MCP", description: "外部工具与数据源", icon: Database },
      { id: "skills", label: "Skill", description: "任务能力扩展", icon: Store }
    ]
  }
];

const settingsNavItems = settingsNavGroups.flatMap((group) => group.items);

const initialThreads: Thread[] = [];

const projectFolders: ProjectFolder[] = [];

const initialMessages: Message[] = [];

const initialApprovals: Approval[] = [];

const initialAuditLogs: AuditLog[] = [];

const defaultAgentSpecs: AgentSpec[] = [
  {
    id: "hotel-orchestrator",
    name: "酒店文旅总控 Agent",
    scope: "跨部门任务分发、上下文编排、审批与质量闭环",
    objective: "把客房、收益、营销、服务、运营和文旅产品放到同一个 AgentSession 中，按业务意图自动选择子 Agent、Skill 和外部系统。",
    systemPrompt: "你是酒店文旅行业的大 Agent 调度器。先理解业务目标和当前上下文，再选择最小必要子 Agent 与工具。涉及订单、价格、退款、客户隐私、对外发布和财务动作时必须走 Policy Gate。",
    model: AUTO_MODEL_LABEL,
    status: "active",
    tools: ["intent.route", "agent.dispatch", "policy.request", "session.compact", "artifact.report"],
    skills: ["AGENTS.md", "hotel-skill-registry", "mcp.json", "external-context"],
    triggers: ["用户在工作台直接下达任务", "PMS/CRM/渠道事件进入", "微信/企微会话携带 followUp/context", "定时任务或异常告警"],
    systems: ["PMS", "CRM", "RMS", "OTA", "POS", "工单系统", "企业微信/微信小程序"],
    stages: [
      {
        name: "理解意图",
        owner: "总控 Agent",
        trigger: "用户或外部系统事件",
        action: "transformContext 后识别任务类型、风险、所需数据源",
        output: "Agent route plan"
      },
      {
        name: "选择 Skill",
        owner: "总控 Agent",
        trigger: "route plan 已生成",
        action: "按 SKILL.md/mcp.json 声明选择原子接口和展示组件",
        output: "Tool call manifest"
      },
      {
        name: "执行与审批",
        owner: "Policy Engine",
        trigger: "工具调用前",
        action: "beforeToolCall 检查权限、客户隐私、价格和财务风险",
        output: "允许、阻断或请求审批"
      },
      {
        name: "交付闭环",
        owner: "Artifact Engine",
        trigger: "工具结果返回",
        action: "生成报告、卡片、话术、工单或系统更新摘要",
        output: "可审计结果"
      }
    ],
    metrics: ["跨系统人工查询减少 40%", "审批动作可追溯", "任务上下文可恢复", "输出质量统一"],
    channels: ["Fiitx Workbench", "微信小程序 AI", "企业微信", "PMS 事件"],
    policy: "ask",
    accent: "blue"
  },
  {
    id: "revenue-manager",
    name: "收益管理 Agent",
    scope: "价格、房态、渠道库存、竞对和活动策略",
    objective: "根据入住率、提前期、节假日、竞对价格和渠道表现给出可审批的调价建议，减少人工看表和重复操作。",
    systemPrompt: "你是酒店收益管理 Agent。你只能提出可解释的价格和库存建议；直接改价、关房、开促销必须请求审批。",
    model: AUTO_MODEL_LABEL,
    status: "ready",
    tools: ["pms.availability.read", "rms.forecast.read", "ota.rate.read", "rate.recommend", "artifact.diff"],
    skills: ["revenue-pricing", "competitor-rate-scan", "holiday-demand-forecast"],
    triggers: ["每日 08:30 收益巡检", "入住率低于阈值", "竞对价格异常", "节假日前 14 天"],
    systems: ["PMS", "RMS", "OTA", "BI 数据仓库"],
    stages: [
      {
        name: "读取经营数据",
        owner: "收益 Agent",
        trigger: "巡检或用户询问",
        action: "读取房态、ADR、RevPAR、渠道库存和竞对价格",
        output: "收益上下文"
      },
      {
        name: "生成策略",
        owner: "收益 Agent",
        trigger: "上下文完整",
        action: "给出调价、控房、促销和渠道优先级建议",
        output: "价格策略草案"
      },
      {
        name: "审批执行",
        owner: "Policy Engine",
        trigger: "涉及价格或库存写入",
        action: "请求审批后调用 PMS/RMS 写入接口",
        output: "执行记录"
      }
    ],
    metrics: ["RevPAR 提升", "人工看板时间降低", "异常价格及时发现", "调价有审计记录"],
    channels: ["工作台", "定时任务", "管理层日报"],
    policy: "ask",
    accent: "green"
  },
  {
    id: "guest-service",
    name: "前台住中服务 Agent",
    scope: "预订确认、入住问答、续住、换房、加购和工单",
    objective: "把前台高频问答和住中服务流转自动化，前台只处理异常、审批和有情绪的复杂场景。",
    systemPrompt: "你是前台住中服务 Agent。回答必须基于酒店政策和当前订单上下文。涉及隐私、退款、换房、账务和跨部门工单时必须记录并走审批策略。",
    model: AUTO_MODEL_LABEL,
    status: "ready",
    tools: ["booking.lookup", "guest.profile.read", "ticket.create", "upsell.offer", "message.reply"],
    skills: ["guest-service", "reservation-assistant", "stay-ticket-router"],
    triggers: ["客人在微信小程序提问", "入住前自动提醒", "住中服务请求", "前台转交"],
    systems: ["PMS", "CRM", "工单系统", "微信小程序", "企业微信"],
    stages: [
      {
        name: "识别客人上下文",
        owner: "服务 Agent",
        trigger: "消息进入",
        action: "读取订单、会员等级、入住日期和历史偏好",
        output: "客人上下文"
      },
      {
        name: "解决或分派",
        owner: "服务 Agent",
        trigger: "意图明确",
        action: "直接回答、生成加购推荐或创建工单",
        output: "回复/工单"
      },
      {
        name: "住中闭环",
        owner: "工单系统",
        trigger: "工单完成",
        action: "同步完成状态并生成满意度追问",
        output: "服务记录"
      }
    ],
    metrics: ["高频问答自动化率", "工单响应时长", "加购转化率", "前台重复工作减少"],
    channels: ["微信小程序 AI", "企业微信", "前台工作台"],
    policy: "ask",
    accent: "blue"
  },
  {
    id: "complaint-recovery",
    name: "客诉补救 Agent",
    scope: "差评预警、投诉分级、补救方案和复盘",
    objective: "在客诉出现早期识别风险，生成标准化补救方案，并把高风险动作交给主管审批。",
    systemPrompt: "你是客诉补救 Agent。先安抚情绪，再核查事实和责任边界。不得擅自承诺赔付、退款或法律责任；需要主管审批。",
    model: AUTO_MODEL_LABEL,
    status: "ready",
    tools: ["sentiment.classify", "review.scan", "ticket.escalate", "compensation.plan", "artifact.postmortem"],
    skills: ["complaint-triage", "service-recovery", "review-response"],
    triggers: ["差评出现", "情绪强烈关键词", "工单超时", "客人要求补偿"],
    systems: ["点评平台", "OTA", "CRM", "工单系统", "PMS"],
    stages: [
      {
        name: "风险分级",
        owner: "客诉 Agent",
        trigger: "评论或消息进入",
        action: "识别情绪、客诉类型、金额和曝光风险",
        output: "风险等级"
      },
      {
        name: "补救建议",
        owner: "客诉 Agent",
        trigger: "风险等级确定",
        action: "生成话术、补偿建议和部门分派",
        output: "补救方案"
      },
      {
        name: "复盘沉淀",
        owner: "运营质检 Agent",
        trigger: "客诉关闭",
        action: "总结根因、责任部门和预防动作",
        output: "复盘报告"
      }
    ],
    metrics: ["差评响应时长", "投诉升级率下降", "补救一致性", "复盘完成率"],
    channels: ["工单系统", "点评平台", "工作台"],
    policy: "ask",
    accent: "amber"
  },
  {
    id: "marketing-content",
    name: "营销内容 Agent",
    scope: "活动策划、图文短视频、渠道投放和私域运营",
    objective: "把酒店房型、餐饮、会议、亲子、周边文旅产品自动转化为多渠道营销素材和投放计划。",
    systemPrompt: "你是酒店文旅营销 Agent。输出必须符合品牌调性、渠道限制和事实边界。涉及对外发布、价格承诺和素材版权时必须审批。",
    model: AUTO_MODEL_LABEL,
    status: "ready",
    tools: ["content.generate", "image.generate", "campaign.plan", "channel.publish", "artifact.preview"],
    skills: ["hotel-marketing", "social-content", "campaign-calendar"],
    triggers: ["新品套餐上线", "节假日活动", "低入住率促销", "用户要求生成素材"],
    systems: ["CMS", "小红书/抖音", "公众号", "微信小程序", "PMS/RMS"],
    stages: [
      {
        name: "抽取卖点",
        owner: "营销 Agent",
        trigger: "活动或产品输入",
        action: "从房型、价格、权益、目的地和人群里抽取卖点",
        output: "卖点卡片"
      },
      {
        name: "生成素材",
        owner: "营销 Agent",
        trigger: "卖点确认",
        action: "生成文案、图片提示词、短视频脚本和渠道版本",
        output: "营销素材 artifact"
      },
      {
        name: "审批发布",
        owner: "Policy Engine",
        trigger: "准备对外发布",
        action: "检查价格、版权、敏感词和品牌规范",
        output: "待发布包"
      }
    ],
    metrics: ["素材生产时间降低", "渠道发布一致性", "活动转化率", "品牌错误减少"],
    channels: ["工作台", "微信小程序", "内容平台"],
    policy: "ask",
    accent: "red"
  },
  {
    id: "concierge-trip",
    name: "礼宾行程 Agent",
    scope: "目的地推荐、行程规划、票务餐饮和本地体验",
    objective: "把酒店周边文旅资源和住客偏好结合，生成可执行的个性化行程，提高住客体验和本地消费转化。",
    systemPrompt: "你是礼宾行程 Agent。推荐必须考虑客人时间、预算、同行人群、天气和酒店可售资源。涉及预订和支付时必须确认并审批。",
    model: AUTO_MODEL_LABEL,
    status: "draft",
    tools: ["poi.search", "itinerary.plan", "weather.lookup", "ticket.reserve", "message.reply"],
    skills: ["destination-concierge", "local-experience", "itinerary-card"],
    triggers: ["客人询问周边怎么玩", "入住前 24 小时", "雨天/节假日提醒", "亲子/商务标签匹配"],
    systems: ["目的地资源库", "票务接口", "餐饮 POS", "PMS", "微信小程序"],
    stages: [
      {
        name: "理解偏好",
        owner: "礼宾 Agent",
        trigger: "客人发起需求",
        action: "读取住客画像、同行人群、停留时间和预算",
        output: "行程约束"
      },
      {
        name: "组合资源",
        owner: "礼宾 Agent",
        trigger: "约束明确",
        action: "组合景点、餐饮、交通和酒店增值服务",
        output: "行程卡片"
      },
      {
        name: "确认预订",
        owner: "Policy Engine",
        trigger: "用户选择方案",
        action: "确认价格、库存、支付和取消规则",
        output: "预订请求"
      }
    ],
    metrics: ["住客满意度", "本地体验转化", "礼宾响应时长", "推荐采纳率"],
    channels: ["微信小程序 AI", "前台", "企业微信"],
    policy: "ask",
    accent: "green"
  },
  {
    id: "ops-quality",
    name: "运营质检 Agent",
    scope: "巡检、SOP、能耗、卫生、设备和服务质量",
    objective: "把巡检、质检、能耗异常和 SOP 执行变成可跟踪任务，提升服务标准一致性。",
    systemPrompt: "你是运营质检 Agent。你负责发现异常、生成检查清单、创建工单和复盘，但不能绕过负责人直接关闭问题。",
    model: AUTO_MODEL_LABEL,
    status: "ready",
    tools: ["checklist.generate", "iot.alert.read", "ticket.create", "sop.lookup", "artifact.report"],
    skills: ["ops-checklist", "energy-alert", "quality-audit"],
    triggers: ["每日巡检", "IoT 告警", "客诉复盘", "SOP 更新"],
    systems: ["IoT/能耗系统", "工单系统", "SOP 知识库", "PMS", "BI"],
    stages: [
      {
        name: "扫描异常",
        owner: "质检 Agent",
        trigger: "巡检或告警",
        action: "读取巡检表、设备告警、客诉和能耗数据",
        output: "异常列表"
      },
      {
        name: "分派任务",
        owner: "质检 Agent",
        trigger: "异常确认",
        action: "匹配 SOP 和责任部门，创建整改任务",
        output: "整改工单"
      },
      {
        name: "质量复盘",
        owner: "总控 Agent",
        trigger: "任务关闭",
        action: "生成趋势和责任闭环报告",
        output: "质检报告"
      }
    ],
    metrics: ["整改闭环率", "SOP 执行一致性", "能耗异常发现", "服务质量提升"],
    channels: ["工作台", "IoT 告警", "工单系统"],
    policy: "auto",
    accent: "amber"
  }
];

const defaultChannelAdapters: ChannelAdapterSpec[] = [
  {
    id: "deepsix-workbench",
    name: "Fiitx Workbench",
    channelType: "desktop-ui",
    description: "桌面工作台入口，承接 chat / coding / artifact / approval 的完整 AgentSession 生命周期。",
    transport: "Electron IPC / local session",
    entrypoint: "Chatbox -> agent:prompt / steer / followUp / abort / compact",
    sessionKeyStrategy: "threadId",
    status: "active",
    capabilities: ["chat", "coding", "artifact", "approval", "followUp", "steer", "abort", "compact"],
    contextSources: ["threadContext", "workspace", "attachments", "external URLs", "selected artifact"],
    outputModes: ["rich markdown", "artifact pane", "inline approval", "execution timeline"],
    followUpPolicy: "绑定当前 threadId，steer 注入当前 turn，followUp 排队进入下一轮。",
    agentBindings: ["hotel-orchestrator", "revenue-manager", "guest-service", "complaint-recovery", "marketing-content", "concierge-trip", "ops-quality"],
    systemPrompt: "这是桌面工作台通道。回答可以更完整，允许输出结构化报告、文件 manifest、审批动作和 artifact 引导。",
    sampleEvent: `{
  "channelId": "deepsix-workbench",
  "threadId": "thread-123",
  "eventType": "prompt",
  "senderId": "desktop-user",
  "replyStyle": "desktop-rich"
}`
  },
  {
    id: "wechat-clawbot",
    name: "微信 ClawBot",
    channelType: "wechat-miniprogram-ai",
    description: "面向微信小程序 AI 的会话 adapter。把微信侧 context / followUp / 页面场景注入到 pi-style AgentSession。",
    transport: "微信小程序 AI / channel adapter",
    entrypoint: "AGENTS.md + SKILL.md + mcp.json + channel event envelope",
    sessionKeyStrategy: "appId + openId + conversationId",
    status: "active",
    capabilities: ["chat", "quick-reply", "followUp", "context-carry", "service-handoff", "compact-mobile-output"],
    contextSources: ["openId", "conversationId", "pagePath", "scene", "tenant/hotelId", "guest profile hint", "mini-program metadata"],
    outputModes: ["mobile-first markdown", "wechat action suggestions", "handoff card", "pending-action summary"],
    followUpPolicy: "同一 conversationId 持续 followUp，不重新开线程；需要转人工时输出待接管动作。",
    agentBindings: ["guest-service", "complaint-recovery", "concierge-trip", "marketing-content", "hotel-orchestrator"],
    systemPrompt: "这是微信小程序 AI 通道。回答应先给用户可直接发送的短答案，再给内部待执行动作。输出适配手机阅读：短段落、短列表、明确下一步。",
    sampleEvent: `{
  "channelId": "wechat-clawbot",
  "conversationId": "wx-conv-001",
  "messageId": "wx-msg-001",
  "senderId": "openid_xxx",
  "senderName": "微信住客",
  "tenantId": "hotel-beijing-haidian",
  "appId": "wx-demo-app",
  "pagePath": "/pages/ai/chat",
  "scene": "guest_service",
  "eventType": "message",
  "replyStyle": "wechat-mini-program"
}`
  }
];

const providerTemplates = [
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com", tag: "尝试 / 默认模型" },
  { name: "MiniMax", baseUrl: "https://api.minimax.chat/v1", tag: "尝试 / 文本与语音" },
  { name: "Kimi", baseUrl: "https://api.moonshot.cn/v1", tag: "尝试 / 长上下文" },
  { name: "清华智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", tag: "尝试 / GLM" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", tag: "模型广场 / fallback" },
  { name: "OpenAI-compatible", baseUrl: "https://api.openai.com/v1", tag: "统一兼容入口" },
  { name: "Anthropic", baseUrl: "https://api.anthropic.com", tag: "长文本 / coding" },
  { name: "Gemini", baseUrl: "https://generativelanguage.googleapis.com", tag: "多模态" },
  { name: "Ollama", baseUrl: "http://localhost:11434", tag: "本地模型" },
  { name: "LiteLLM", baseUrl: "http://localhost:4000", tag: "企业网关" },
  { name: "vLLM", baseUrl: "http://localhost:8000/v1", tag: "私有部署" },
  { name: "阿里百炼", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", tag: "国产模型" },
  { name: "火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", tag: "国产模型" },
  { name: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1", tag: "国产模型" },
  { name: "Moonshot/Kimi", baseUrl: "https://api.moonshot.cn/v1", tag: "长上下文" }
];

const providerModelDefaults: Record<string, string> = {
  DeepSeek: "deepseek-v4-flash",
  MiniMax: "minimax-text-01",
  Kimi: "moonshot-v1-128k",
  "清华智谱 GLM": "glm-4-flash",
  OpenRouter: "openrouter/auto",
  "OpenAI-compatible": "gpt-4o-mini",
  "硅基流动": "deepseek-ai/DeepSeek-V3",
  "阿里百炼": "qwen-plus",
  "火山方舟": "deepseek-v3-250324"
};

const providerContextWindowDefaults: Record<string, number> = {
  DeepSeek: 64000,
  MiniMax: 100000,
  Kimi: 128000,
  "清华智谱 GLM": 64000,
  OpenRouter: 128000,
  "OpenAI-compatible": 128000,
  Anthropic: 200000,
  Gemini: 1000000,
  "硅基流动": 64000,
  "阿里百炼": 128000,
  "火山方舟": 128000
};

const providerCapabilityDefaults: Record<string, Partial<ModelForm>> = {
  DeepSeek: {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "cheap"]
  },
  MiniMax: {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["writing", "research", "long-context"]
  },
  Kimi: {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["research", "writing", "long-context"]
  },
  "清华智谱 GLM": {
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["research", "writing", "cheap"]
  },
  OpenRouter: {
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "vision", "image", "video", "long-context"]
  },
  "硅基流动": {
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "vision", "image", "cheap"]
  }
};

const providerAliases: Record<string, string[]> = {
  DeepSeek: ["deepseek", "deep seek", "深度求索", "深度求索ai"],
  MiniMax: ["minimax", "mini max", "海螺", "abab"],
  Kimi: ["kimi", "moonshot", "月之暗面"],
  "清华智谱 GLM": ["glm", "智谱", "智谱清言", "bigmodel", "zhipu"],
  OpenRouter: ["openrouter", "open router"],
  "OpenAI-compatible": ["openai", "chatgpt", "gpt"],
  Anthropic: ["anthropic", "claude"],
  Gemini: ["gemini", "google ai", "google"],
  "硅基流动": ["硅基流动", "siliconflow", "silicon flow"],
  "阿里百炼": ["阿里百炼", "百炼", "dashscope", "通义", "qwen"],
  "火山方舟": ["火山方舟", "火山", "volcengine", "doubao", "豆包"]
};

const modelProviderHints: Array<{ pattern: RegExp; provider: string; model?: string }> = [
  { pattern: /deepseek-v4-flash/i, provider: "DeepSeek", model: "deepseek-v4-flash" },
  { pattern: /deepseek-v4-pro/i, provider: "DeepSeek", model: "deepseek-v4-pro" },
  { pattern: /deepseek(?:-ai)?\/deepseek-v3/i, provider: "硅基流动", model: "deepseek-ai/DeepSeek-V3" },
  { pattern: /minimax-text-01/i, provider: "MiniMax", model: "minimax-text-01" },
  { pattern: /moonshot-v1-128k/i, provider: "Kimi", model: "moonshot-v1-128k" },
  { pattern: /glm-4-flash/i, provider: "清华智谱 GLM", model: "glm-4-flash" },
  { pattern: /openrouter\/auto|openrouter-auto|openrouter auto/i, provider: "OpenRouter", model: "openrouter/auto" },
  { pattern: /qwen-[\w.-]+/i, provider: "阿里百炼" },
  { pattern: /doubao-[\w.-]+/i, provider: "火山方舟" },
  { pattern: /gpt-[\w.-]+/i, provider: "OpenAI-compatible" },
  { pattern: /claude-[\w.-]+/i, provider: "Anthropic" },
  { pattern: /gemini-[\w.-]+/i, provider: "Gemini" }
];

const apiKeyPattern = /\b(?:sk|rk|pk|ak)-[A-Za-z0-9][A-Za-z0-9._-]{12,}\b|\bAIza[0-9A-Za-z_-]{20,}\b/g;

type ChatModelConfigIntent = {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  hasConfigurationSignal: boolean;
};

function maskSecret(value: string) {
  if (value.length <= 12) {
    return "****";
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function redactSecrets(text: string) {
  return text.replace(apiKeyPattern, (match) => maskSecret(match));
}

function slug(value: string) {
  return String(value || "model")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "model";
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

function inferProviderFromText(text: string) {
  const normalized = text.toLowerCase();
  for (const [provider, aliases] of Object.entries(providerAliases)) {
    if (includesAny(normalized, aliases)) {
      return provider;
    }
  }

  return "";
}

function inferModelFromText(text: string) {
  for (const hint of modelProviderHints) {
    const matched = text.match(hint.pattern);
    if (matched) {
      return {
        provider: hint.provider,
        model: hint.model ?? matched[0]
      };
    }
  }

  const explicitModel = text.match(/(?:模型|model)\s*(?:是|=|:|：)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,80})/i);
  if (explicitModel?.[1]) {
    return {
      provider: inferProviderFromText(text),
      model: explicitModel[1]
    };
  }

  return {
    provider: "",
    model: ""
  };
}

function inferBaseUrlFromText(text: string) {
  return text.match(/https?:\/\/[^\s"'，。；;]+/i)?.[0] ?? "";
}

function buildModelPayloadFromChat(text: string, recentMessages: Message[]): ChatModelConfigIntent {
  const contextText = recentMessages
    .slice(-8)
    .map((message) => message.body)
    .concat(text)
    .join("\n");
  const apiKey = text.match(apiKeyPattern)?.[0] ?? "";
  const currentModel = inferModelFromText(text);
  const contextualModel = currentModel.model ? currentModel : inferModelFromText(contextText);
  const provider = currentModel.provider || inferProviderFromText(text) || contextualModel.provider || inferProviderFromText(contextText);
  const model = currentModel.model || contextualModel.model || (provider ? providerModelDefaults[provider] : "");
  const baseUrl = inferBaseUrlFromText(text) || (providerTemplates.find((item) => item.name === provider)?.baseUrl ?? "");
  const normalizedText = text.toLowerCase();
  const hasConfigurationSignal = Boolean(
    apiKey ||
      inferBaseUrlFromText(text) ||
      currentModel.provider ||
      currentModel.model ||
      inferProviderFromText(text) ||
      normalizedText.includes("api key") ||
      normalizedText.includes("apikey") ||
      normalizedText.includes("key") ||
      normalizedText.includes("模型") ||
      normalizedText.includes("profile") ||
      normalizedText.includes("配置")
  );

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    hasConfigurationSignal
  };
}

function hasExplicitModelConfigSignal(text: string) {
  return Boolean(
    text.match(apiKeyPattern)?.[0] ||
      /(api\s*key|apikey|密钥|key|模型配置|配置模型|保存.*模型|保存.*key|profile|provider|base\s*url|baseurl|模型中心|这是.*key|这个.*key)/i.test(text)
  );
}

function looksLikeBareModelConfigValue(text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120 || /[，。！？!?]/.test(trimmed)) {
    return false;
  }
  return Boolean(
    trimmed.match(apiKeyPattern)?.[0] ||
      /^https?:\/\/[^\s]+$/i.test(trimmed) ||
      inferProviderFromText(trimmed) ||
      inferModelFromText(trimmed).model
  );
}

function hasNaturalTaskSignal(text: string) {
  return /(官网|网站|网页|页面|内容|抓取|抓起来|读取|文件|附件|ppt|素材|生成|画|做|写|开发|修复|分析|总结|解释|升级|html|动画|小程序|订单|行程|投诉|客人|住客)/i.test(text);
}

const defaultProfiles: FiitxModelProfile[] = [
  {
    id: "default-deepseek-v4-flash",
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    apiKeyRef: "keychain:DeepSeek:deepseek-v4-flash",
    contextWindow: 64000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "cheap"],
    toolCallStyle: "openai",
    updatedAt: "default"
  },
  {
    id: "default-minimax",
    provider: "MiniMax",
    model: "minimax-text-01",
    baseUrl: "https://api.minimax.chat/v1",
    apiKeyRef: "keychain:MiniMax:minimax-text-01",
    contextWindow: 100000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["writing", "research", "long-context"],
    toolCallStyle: "openai",
    updatedAt: "default"
  }
];

const artifactTabs: Array<{ id: ArtifactId; label: string; icon: LucideIcon }> = [
  { id: "report", label: "报告", icon: FileText },
  { id: "ppt", label: "PPT", icon: Presentation },
  { id: "diff", label: "Diff", icon: GitBranch },
  { id: "image", label: "预览", icon: Image }
];

const bestForOptions = ["coding", "research", "writing", "ppt", "vision", "image", "video", "audio", "cheap", "long-context"];

const permissionOptions: Array<{ id: PermissionMode; label: string; auditLabel: string }> = [
  { id: "ask", label: "请求批准", auditLabel: "请求用户批准" },
  { id: "auto", label: "替我审批", auditLabel: "自动替用户审批" },
  { id: "full", label: "完全访问权限", auditLabel: "完全访问权限" }
];

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif"]);
const videoExtensions = new Set(["mp4", "mov", "m4v", "webm", "ogv"]);
const audioExtensions = new Set(["mp3", "m4a", "wav", "ogg", "flac", "aac"]);
const htmlExtensions = new Set(["html", "htm"]);
const pdfExtensions = new Set(["pdf"]);
const artifactPreviewExtensions = new Set([
  ...imageExtensions,
  ...videoExtensions,
  ...audioExtensions,
  ...htmlExtensions,
  ...pdfExtensions,
  "doc",
  "docx",
  "key",
  "md",
  "markdown",
  "ppt",
  "pptx",
  "rtf",
  "txt"
]);
const inlineStreamEventLimit = 14;

const fileArtifacts: FileArtifact[] = [];

function emptyThreadRecord(): ThreadRecord {
  return {
    messages: [],
    progressEvents: [],
    artifacts: [],
    lastAgentArtifact: null,
    executionArtifacts: [],
    activeAgentTaskId: "",
    executionStartedAt: null,
    executionFinishedAt: null,
    executionExpanded: false,
    sessionEntries: [],
    currentEntryId: null
  };
}

function normalizeThreadRecord(record?: Partial<ThreadRecord> | null): ThreadRecord {
  return {
    ...emptyThreadRecord(),
    ...(record ?? {}),
    messages: Array.isArray(record?.messages) ? record.messages : [],
    progressEvents: Array.isArray(record?.progressEvents) ? record.progressEvents : [],
    artifacts: Array.isArray(record?.artifacts) ? record.artifacts : [],
    executionArtifacts: Array.isArray(record?.executionArtifacts) ? record.executionArtifacts : [],
    lastAgentArtifact: record?.lastAgentArtifact ?? null,
    activeAgentTaskId: record?.activeAgentTaskId ?? "",
    executionStartedAt: record?.executionStartedAt ?? null,
    executionFinishedAt: record?.executionFinishedAt ?? null,
    executionExpanded: Boolean(record?.executionExpanded),
    sessionEntries: Array.isArray(record?.sessionEntries) ? record.sessionEntries : [],
    currentEntryId: record?.currentEntryId ?? null
  };
}

function applyStateUpdate<T>(current: T, update: T | ((current: T) => T)) {
  return typeof update === "function" ? (update as (current: T) => T)(current) : update;
}

function timeNow() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function riskLabel(risk: Approval["risk"]) {
  return risk === "high" ? "高风险" : risk === "medium" ? "中风险" : "低风险";
}

function statusLabel(status: ThreadStatus) {
  if (status === "running") {
    return "运行中";
  }
  if (status === "waiting") {
    return "待审批";
  }
  return "已完成";
}

function pathSlug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
}

function folderNameFromPath(value: string) {
  return value.split("/").filter(Boolean).slice(-1)[0] || "项目";
}

function buildFallbackTaskTitle(prompt: string) {
  const clean = prompt
    .replace(/\s+/g, " ")
    .replace(/[，。；;,.!?！？]+$/g, "")
    .trim();
  if (!clean) {
    return "未命名任务";
  }
  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean;
}

function profileSummary(profile: FiitxModelProfile) {
  const flags = [
    profile.supportsTools ? "tools" : "",
    profile.supportsVision ? "vision" : "",
    profile.supportsStreaming ? "streaming" : "",
    profile.supportsJsonMode ? "json" : ""
  ].filter(Boolean);
  return flags.join(" / ");
}

function hasProfileKey(profile: FiitxModelProfile) {
  if (profile.keyStatus) {
    return profile.keyStatus === "available";
  }
  return profile.hasApiKey === true;
}

function profileKeyLabel(profile: FiitxModelProfile) {
  if (hasProfileKey(profile)) {
    return profile.apiKeyRef;
  }
  if (profile.keyStatus === "locked") {
    return "API Key 无法解密，请重新保存";
  }
  return "未保存 API Key，自动路由不会调用";
}

function formatRouteLatency(profile: FiitxModelProfile) {
  const latency = profile.routeStats?.averageLatencyMs || profile.routeStats?.lastLatencyMs || profile.expectedLatencyMs || 0;
  if (!latency) {
    return "延迟未记录";
  }
  return latency >= 1000 ? `${(latency / 1000).toFixed(1)}s` : `${latency}ms`;
}

function formatRouteSuccess(profile: FiitxModelProfile) {
  const successRate = profile.routeStats?.successRate;
  if (typeof successRate !== "number") {
    return "成功率未记录";
  }
  return `成功率 ${(successRate * 100).toFixed(0)}%`;
}

function formatRouteCost(profile: FiitxModelProfile) {
  const input = Number(profile.inputCostPer1M || 0);
  const output = Number(profile.outputCostPer1M || 0);
  if (!input && !output) {
    return "成本未配置";
  }
  return `$${input}/${output} per 1M`;
}

function profileRouteLabel(profile: FiitxModelProfile) {
  const health = profile.routeStats?.circuitOpen
    ? "熔断中"
    : profile.routeStats?.consecutiveFailures
      ? `连续失败 ${profile.routeStats.consecutiveFailures}`
      : "可路由";
  return `${health} · ${formatRouteLatency(profile)} · ${formatRouteSuccess(profile)} · ${formatRouteCost(profile)}`;
}

export default function App() {
  const [activeView, setActiveView] = useState<View>("workbench");
  const [uiLocale, setUiLocale] = useState<UiLocale>(() => getInitialUiLocale());
  const [activeSettingsPage, setActiveSettingsPage] = useState<SettingsPage>("about");
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(DRAFT_THREAD_ID);
  const [messages, setMessages] = useState(initialMessages);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactId>("report");
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("preview");
  const [artifactMaximized, setArtifactMaximized] = useState(false);
  const [visualSourceModes, setVisualSourceModes] = useState<Record<string, "preview" | "source">>({});
  const [composer, setComposer] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileArtifact | null>(null);
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState<{ path: string; requestId: number } | null>(null);
  const [artifacts, setArtifacts] = useState<FileArtifact[]>(fileArtifacts);
  const [expandedResourceGroups, setExpandedResourceGroups] = useState<Record<string, boolean>>({});
  const [resourceContextMenu, setResourceContextMenu] = useState<{ path: string; x: number; y: number } | null>(null);
  const [activeAgentTaskId, setActiveAgentTaskId] = useState("");
  const [agentProgressEvents, setAgentProgressEvents] = useState<FiitxAgentProgress[]>([]);
  const [agentSpecs, setAgentSpecs] = useState<AgentSpec[]>(defaultAgentSpecs);
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentSpecs[0]?.id ?? "");
  const [channelAdapters, setChannelAdapters] = useState<ChannelAdapterSpec[]>(defaultChannelAdapters);
  const [selectedChannelAdapterId, setSelectedChannelAdapterId] = useState(defaultChannelAdapters[0]?.id ?? "");
  const [activeChannelAdapterId, setActiveChannelAdapterId] = useState(defaultChannelAdapters[0]?.id ?? "");
  const [lastAgentArtifact, setLastAgentArtifact] = useState<FileArtifact | null>(null);
  const [executionArtifacts, setExecutionArtifacts] = useState<FileArtifact[]>([]);
  const [executionExpanded, setExecutionExpanded] = useState(false);
  const [executionStartedAt, setExecutionStartedAt] = useState<number | null>(null);
  const [executionFinishedAt, setExecutionFinishedAt] = useState<number | null>(null);
  const [statusNow, setStatusNow] = useState(Date.now());
  const [threadRecords, setThreadRecords] = useState<Record<string, ThreadRecord>>({});
  const [pathInfoMap, setPathInfoMap] = useState<Record<string, PathInfo>>({});
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectFoldersState, setProjectFoldersState] = useState(projectFolders);
  const [rootThreadIds, setRootThreadIds] = useState<string[]>([]);
  const [selectedProjectFolderId, setSelectedProjectFolderId] = useState<string | null>(null);
  const [collapsedProjectFolders, setCollapsedProjectFolders] = useState<Record<string, boolean>>({});
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const [policySettings, setPolicySettings] = useState<PolicySettings>(defaultPolicySettings);
  const [agentRunning, setAgentRunning] = useState(false);
  const [abortPending, setAbortPending] = useState(false);
  const [visiblePanels, setVisiblePanels] = useState<Record<PanelKey, boolean>>({
    sidebar: true,
    artifact: false,
    terminal: false
  });
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [workspacePath, setWorkspacePath] = useState("");
  const [profiles, setProfiles] = useState<FiitxModelProfile[]>([]);
  const [autoModelRouting, setAutoModelRouting] = useState(true);
  const [platform, setPlatform] = useState("macOS");
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "passed" | "failed">("idle");
  const [testMessage, setTestMessage] = useState("等待连接测试");
  const [savingProfile, setSavingProfile] = useState(false);
  const [modelForm, setModelForm] = useState<ModelForm>({
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    apiKey: "",
    contextWindow: 64000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    bestFor: ["coding", "research", "cheap"],
    toolCallStyle: "openai"
  });
  const [threadStateLoaded, setThreadStateLoaded] = useState(false);
  const [routeLabPrompt, setRouteLabPrompt] = useState("客人投诉房间异味，帮我分级并生成补救方案。");
  const [routeLabResult, setRouteLabResult] = useState<FiitxAgentRouteInspection | null>(null);
  const [routeLabLoading, setRouteLabLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<FiitxAgentEvalResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [harnessSnapshot, setHarnessSnapshot] = useState<FiitxAgentHarnessSnapshot | null>(null);
  const [harnessLoading, setHarnessLoading] = useState(false);
  const [mcpConfig, setMcpConfig] = useState<FiitxMcpConfig | null>(null);
  const [mcpSnapshot, setMcpSnapshot] = useState<FiitxMcpSnapshot | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpForm, setMcpForm] = useState<FiitxMcpServerConfig>({
    id: "",
    name: "",
    type: "stdio",
    enabled: true,
    command: "",
    args: [],
    cwd: "",
    url: "",
    risk: "medium",
    timeoutMs: 12000
  });
  const [mcpArgsText, setMcpArgsText] = useState("");
  const [mcpEnvText, setMcpEnvText] = useState("{}");
  const [mcpHeadersText, setMcpHeadersText] = useState("{}");
  const [mcpStatusMessage, setMcpStatusMessage] = useState("");
  const [mcpFormOpen, setMcpFormOpen] = useState(false);
  const [skillCatalog, setSkillCatalog] = useState<unknown[]>([]);
  const [installedSkills, setInstalledSkills] = useState<unknown[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillInstallRoot, setSkillInstallRoot] = useState("");
  const [skillStatusMessage, setSkillStatusMessage] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [agentAdminOpen, setAgentAdminOpen] = useState(false);
  const [agentDebugOpen, setAgentDebugOpen] = useState(false);
  const [historySnapshot, setHistorySnapshot] = useState<FiitxAgentHistorySnapshot | null>(null);
  const [historyTrace, setHistoryTrace] = useState<FiitxAgentTrace | null>(null);
  const [historyCompare, setHistoryCompare] = useState<FiitxRunCompare | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryThreadId, setSelectedHistoryThreadId] = useState("");
  const [compareLeftThreadId, setCompareLeftThreadId] = useState("");
  const [compareRightThreadId, setCompareRightThreadId] = useState("");
  const [versionDiffLeftId, setVersionDiffLeftId] = useState("");
  const [versionDiffRightId, setVersionDiffRightId] = useState("");

  const activeThread = useMemo<Thread>(
    () =>
      threads.find((thread) => thread.id === activeThreadId) ?? {
        id: DRAFT_THREAD_ID,
        title: "未命名任务",
        kind: "Chat / Coding",
        model: AUTO_MODEL_LABEL,
        status: "waiting",
        updatedAt: "",
        createdAt: 0
      },
    [activeThreadId, threads]
  );
  const selectedAgent = useMemo(
    () => agentSpecs.find((agent) => agent.id === selectedAgentId) ?? agentSpecs[0],
    [agentSpecs, selectedAgentId]
  );
  const selectedChannelAdapter = useMemo(
    () => channelAdapters.find((adapter) => adapter.id === selectedChannelAdapterId) ?? channelAdapters[0],
    [channelAdapters, selectedChannelAdapterId]
  );
  const activeChannelAdapter = useMemo(
    () => channelAdapters.find((adapter) => adapter.id === activeChannelAdapterId) ?? channelAdapters[0],
    [channelAdapters, activeChannelAdapterId]
  );

  const pendingApprovalCount = approvals.filter((approval) => approval.status === "pending").length;
  const visibleAgentProgress = activeAgentTaskId
    ? agentProgressEvents.filter((event) => event.taskId === activeAgentTaskId)
    : agentProgressEvents;
  const latestProgress = visibleAgentProgress[visibleAgentProgress.length - 1];
  const taskScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);
  const currentLocaleMeta = supportedLocales.find((item) => item.id === uiLocale) ?? supportedLocales[0];

  function t(key: string, values?: Record<string, string | number>) {
    return interpolate(i18n[uiLocale]?.[key] ?? i18n.en[key] ?? key, values);
  }

  function updateUiLocale(nextLocale: UiLocale) {
    setUiLocale(nextLocale);
    window.localStorage?.setItem(I18N_STORAGE_KEY, nextLocale);
  }

  function settingsLabel(page: SettingsPage) {
    return t(`nav.${page}`);
  }

  function settingsDescription(page: SettingsPage) {
    return t(`nav.${page}.desc`);
  }

  function permissionLabel(mode: PermissionMode) {
    return t(`permissions.${mode}`);
  }

  function threadStatusLabel(status: ThreadStatus) {
    return t(`status.${status}`);
  }

  function isPersistableThread(threadId: string) {
    return Boolean(threadId && threadId !== DRAFT_THREAD_ID);
  }

  function snapshotCurrentThreadRecord(overrides: Partial<ThreadRecord> = {}) {
    const existingRecord = normalizeThreadRecord(threadRecords[activeThreadId] as Partial<ThreadRecord> | undefined);
    return normalizeThreadRecord({
      messages,
      progressEvents: agentProgressEvents,
      artifacts,
      lastAgentArtifact,
      executionArtifacts,
      activeAgentTaskId,
      executionStartedAt,
      executionFinishedAt,
      executionExpanded,
      sessionEntries: existingRecord.sessionEntries,
      currentEntryId: existingRecord.currentEntryId,
      ...overrides
    });
  }

  function cacheThreadRecord(threadId = activeThreadId, overrides: Partial<ThreadRecord> = {}) {
    if (!isPersistableThread(threadId)) {
      return;
    }

    const nextRecord = snapshotCurrentThreadRecord(overrides);
    setThreadRecords((current) => ({
      ...current,
      [threadId]: nextRecord
    }));
  }

  function updateThreadRecord(threadId: string, updater: (record: ThreadRecord) => ThreadRecord) {
    if (!isPersistableThread(threadId)) {
      return;
    }

    setThreadRecords((current) => {
      const previous = normalizeThreadRecord(current[threadId]);
      return {
        ...current,
        [threadId]: normalizeThreadRecord(updater(previous))
      };
    });
  }

  function appendSessionEntryToRecord(record: ThreadRecord, kind: SessionEntry["kind"], payload: unknown) {
    const entry: SessionEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      parentId: record.currentEntryId,
      kind,
      time: new Date().toISOString(),
      payload
    };

    return normalizeThreadRecord({
      ...record,
      sessionEntries: record.sessionEntries.concat(entry),
      currentEntryId: entry.id
    });
  }

  function appendThreadSessionEntry(threadId: string, kind: SessionEntry["kind"], payload: unknown) {
    updateThreadRecord(threadId, (record) => appendSessionEntryToRecord(record, kind, payload));
  }

  function loadThreadRecordIntoWorkbench(threadId: string, records = threadRecords) {
    const record = normalizeThreadRecord(records[threadId] as Partial<ThreadRecord> | undefined);
    setMessages(record.messages);
    setAgentProgressEvents(record.progressEvents);
    setArtifacts(record.artifacts);
    setLastAgentArtifact(record.lastAgentArtifact);
    setExecutionArtifacts(record.executionArtifacts);
    setActiveAgentTaskId(record.activeAgentTaskId);
    setExecutionStartedAt(record.executionStartedAt);
    setExecutionFinishedAt(record.executionFinishedAt);
    setExecutionExpanded(record.executionExpanded);
    setSelectedFile(null);
  }

  useEffect(() => {
    window.fiitx?.getPlatform().then((result) => {
	      setPlatform(result.platform === "darwin" ? "macOS" : result.platform);
	      setEncryptionAvailable(result.encryptionAvailable);
	      const storedLocale = window.localStorage?.getItem(I18N_STORAGE_KEY);
	      const systemLocale = normalizeUiLocale(result.locale);
	      if (!storedLocale && systemLocale) {
	        setUiLocale(systemLocale);
	      }
	      if (result.defaultWorkspace) {
	        setWorkspacePath((current) => current || result.defaultWorkspace || "");
	      }
	    });

    window.fiitx?.listModelProfiles().then((savedProfiles) => {
      setProfiles(savedProfiles);
    });
	  }, []);

  useEffect(() => {
    document.documentElement.lang = uiLocale;
    document.documentElement.dir = currentLocaleMeta.dir;
  }, [currentLocaleMeta.dir, uiLocale]);

  useEffect(() => {
    let cancelled = false;

    window.fiitx?.loadThreadState?.().then((state) => {
      if (cancelled || !state) {
        return;
      }

      const loadedThreads = Array.isArray(state.threads) ? state.threads as Thread[] : [];
      const loadedFolders = Array.isArray(state.projectFolders) ? state.projectFolders as ProjectFolder[] : [];
      const loadedRootThreadIds = Array.isArray(state.rootThreadIds) ? state.rootThreadIds : [];
      const loadedAgentSpecs = Array.isArray(state.agentSpecs) && state.agentSpecs.length > 0 ? state.agentSpecs as AgentSpec[] : defaultAgentSpecs;
      const loadedChannelAdapters = Array.isArray((state as FiitxThreadState).channelAdapters) && (state as FiitxThreadState).channelAdapters!.length > 0
        ? (state as FiitxThreadState).channelAdapters as ChannelAdapterSpec[]
        : defaultChannelAdapters;
      const rawRecords = (state.threadRecords ?? {}) as Record<string, Partial<ThreadRecord>>;
      const loadedRecords = Object.fromEntries(
        Object.entries(rawRecords).map(([threadId, record]) => [threadId, normalizeThreadRecord(record)])
      );
      const targetThreadId =
        state.activeThreadId && loadedThreads.some((thread) => thread.id === state.activeThreadId)
          ? state.activeThreadId
          : DRAFT_THREAD_ID;

      setThreads(loadedThreads);
      setProjectFoldersState(loadedFolders);
      setRootThreadIds(loadedRootThreadIds.filter((threadId) => loadedThreads.some((thread) => thread.id === threadId)));
      setAgentSpecs(loadedAgentSpecs);
      setSelectedAgentId(
        state.selectedAgentId && loadedAgentSpecs.some((agent) => agent.id === state.selectedAgentId)
          ? state.selectedAgentId
          : loadedAgentSpecs[0]?.id ?? ""
      );
      setChannelAdapters(loadedChannelAdapters);
      setSelectedChannelAdapterId(
        (state as FiitxThreadState).selectedChannelAdapterId && loadedChannelAdapters.some((adapter) => adapter.id === (state as FiitxThreadState).selectedChannelAdapterId)
          ? (state as FiitxThreadState).selectedChannelAdapterId as string
          : loadedChannelAdapters[0]?.id ?? ""
      );
      setActiveChannelAdapterId(
        (state as FiitxThreadState).activeChannelAdapterId && loadedChannelAdapters.some((adapter) => adapter.id === (state as FiitxThreadState).activeChannelAdapterId)
          ? (state as FiitxThreadState).activeChannelAdapterId as string
          : loadedChannelAdapters[0]?.id ?? ""
      );
      setThreadRecords(loadedRecords);
      setApprovals(Array.isArray(state.approvals) ? state.approvals as Approval[] : []);
      setAuditLogs(Array.isArray(state.auditLogs) ? state.auditLogs as AuditLog[] : []);
      if (state.policySettings) {
        const loadedPolicy = state.policySettings as Partial<PolicySettings>;
        setPolicySettings({
          ...defaultPolicySettings,
          ...loadedPolicy,
          actionModes: {
            ...defaultPolicySettings.actionModes,
            ...(loadedPolicy.actionModes ?? {})
          }
        });
        if (loadedPolicy.defaultPermissionMode) {
          setPermissionMode(loadedPolicy.defaultPermissionMode);
        }
      }
      if (state.workspacePath) {
        setWorkspacePath(state.workspacePath as string);
      }
      if (typeof state.autoModelRouting === "boolean") {
        setAutoModelRouting(state.autoModelRouting);
      }
      setActiveThreadId(targetThreadId);

      if (isPersistableThread(targetThreadId)) {
        loadThreadRecordIntoWorkbench(targetThreadId, loadedRecords);
      } else {
        loadThreadRecordIntoWorkbench(DRAFT_THREAD_ID, {});
      }
    }).finally(() => {
      if (!cancelled) {
        setThreadStateLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!threadStateLoaded) {
      return;
    }

    const recordsToSave: Record<string, ThreadRecord> = { ...threadRecords };
    if (isPersistableThread(activeThreadId)) {
      recordsToSave[activeThreadId] = snapshotCurrentThreadRecord();
    }

    const timer = window.setTimeout(() => {
      void window.fiitx?.saveThreadState?.({
        activeThreadId: isPersistableThread(activeThreadId) ? activeThreadId : "",
        workspacePath,
        threads,
        projectFolders: projectFoldersState,
        rootThreadIds,
        threadRecords: recordsToSave,
        agentSpecs,
        selectedAgentId,
        channelAdapters,
        selectedChannelAdapterId,
        activeChannelAdapterId,
        approvals,
        auditLogs,
        policySettings,
        autoModelRouting
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    activeThreadId,
    agentProgressEvents,
    agentSpecs,
    approvals,
    artifacts,
    auditLogs,
    activeChannelAdapterId,
    autoModelRouting,
    channelAdapters,
    executionArtifacts,
    executionExpanded,
    executionFinishedAt,
    executionStartedAt,
    lastAgentArtifact,
    messages,
    projectFoldersState,
    policySettings,
    rootThreadIds,
    selectedChannelAdapterId,
    selectedAgentId,
    threadRecords,
    threads,
    threadStateLoaded,
    workspacePath
  ]);

  useEffect(() => {
    const unsubscribe = window.fiitx?.onAgentProgress?.((event) => {
      const targetThreadId = event.threadId || activeThreadId;
      if (targetThreadId === activeThreadId) {
        setAgentProgressEvents((current) => current.concat(event).slice(-64));
        setMessages((current) => applyAgentStreamEventToMessages(current, event));
      }
      updateThreadRecord(targetThreadId, (record) => ({
        ...record,
        messages: applyAgentStreamEventToMessages(record.messages, event),
        progressEvents: record.progressEvents.concat(event).slice(-64)
      }));
    });

    return () => unsubscribe?.();
  }, [activeThreadId]);

  useEffect(() => {
    const unsubscribe = window.fiitx?.onWechatChannelInbound?.((event) => {
      const conversationId = event.inbound?.conversationId || `wechat-${Date.now()}`;
      const threadId = `thread-wechat-${pathSlug(conversationId).slice(0, 80) || "local"}`;
      const existingThread = threads.find((thread) => thread.id === threadId);
      const receivedAt = timeNow();
      const card = event.reply?.primaryCard as Record<string, unknown> | undefined;
      const cardTitle = String(card?.title || card?.apiName || "微信卡片");
      const artifact: FileArtifact | null = card
        ? {
            path: `wechat://${conversationId}/${String(card.apiName || "card")}`,
            title: `微信卡片：${cardTitle}`,
            language: "wechat-card",
            status: "added",
            additions: 0,
            deletions: 0,
            preview: JSON.stringify(card, null, 2)
          }
        : null;

      const nextThread: Thread = existingThread ?? {
        id: threadId,
        title: buildFallbackTaskTitle(event.inbound?.text || "微信客户消息"),
        kind: "微信 ClawBot",
        model: "fiitx-gateway",
        status: "done",
        updatedAt: "刚刚",
        createdAt: Date.now(),
        workspacePath,
        projectFolderId: null
      };

      setThreads((current) => {
        const withoutThread = current.filter((thread) => thread.id !== threadId);
        return [
          {
            ...nextThread,
            title: nextThread.title || buildFallbackTaskTitle(event.inbound?.text || "微信客户消息"),
            status: "done",
            updatedAt: "刚刚"
          },
          ...withoutThread
        ];
      });
      setRootThreadIds((current) => [threadId, ...current.filter((item) => item !== threadId)]);
      setProjectFoldersState((current) =>
        current.map((folder) => ({
          ...folder,
          threads: folder.threads.filter((item) => item !== threadId)
        }))
      );
      setThreadRecords((current) => ({
        ...current,
        [threadId]: normalizeThreadRecord(current[threadId] as Partial<ThreadRecord> | undefined)
      }));
      setActiveThreadId(threadId);

      updateMessagesForThread(threadId, (current) => [
        ...current,
        {
          id: `message-wechat-user-${event.inbound?.messageId || Date.now()}`,
          role: "user",
          author: "微信客户",
          body: event.inbound?.text || "",
          time: receivedAt
        },
        {
          id: `message-wechat-agent-${Date.now()}`,
          role: "agent",
          author: "Fiitx Gateway",
          body: event.reply?.text || "已通过微信 Channel 处理。",
          time: receivedAt
        }
      ], true);

      if (artifact) {
        updateArtifactsForThread(threadId, (current) => [artifact, ...current.filter((item) => item.path !== artifact.path)], true);
        setThreadLastArtifact(threadId, artifact, true);
        setThreadExecutionArtifacts(threadId, [artifact], true);
        selectFileArtifact(artifact, { openPanel: false });
      }

      recordAgentProgress(
        `wechat-channel-${event.inbound?.messageId || Date.now()}`,
        "微信 Channel",
        artifact ? `已返回 ${artifact.title}` : event.reply?.text || "已处理微信消息",
        event.ok ? "success" : "warn",
        threadId,
        true
      );
      addAudit("微信 ClawBot", "接收小程序消息", event.inbound?.text || conversationId, event.ok ? "success" : "warn");
    });

    return () => unsubscribe?.();
  }, [activeThreadId, threads, workspacePath]);

  useEffect(() => {
    if (!agentRunning && !terminalRunning) {
      return;
    }

    const timer = window.setInterval(() => setStatusNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [agentRunning, terminalRunning]);

  useEffect(() => {
    if (activeView !== "workbench") {
      return;
    }

    window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      const scrollArea = taskScrollRef.current;
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    });
  }, [messages, visibleAgentProgress.length, agentRunning, executionExpanded, activeView]);

  useEffect(() => {
    if (activeView !== "settings" || activeSettingsPage !== "agents" || harnessSnapshot || harnessLoading) {
      return;
    }
    void refreshHarnessSnapshot();
  }, [activeView, activeSettingsPage, harnessSnapshot, harnessLoading]);

  useEffect(() => {
    if (activeView !== "settings" || !["mcp", "skills"].includes(activeSettingsPage)) {
      return;
    }
    if (activeSettingsPage === "mcp" && !mcpConfig && !mcpLoading) {
      void loadMcpManagement(false);
    }
    if (activeSettingsPage === "skills" && installedSkills.length === 0 && skillCatalog.length === 0 && !skillLoading) {
      void loadSkillManagement();
    }
  }, [activeView, activeSettingsPage, mcpConfig, mcpLoading, installedSkills.length, skillCatalog.length, skillLoading]);

  useEffect(() => {
    if (activeView !== "settings" || activeSettingsPage !== "history" || historySnapshot || historyLoading) {
      return;
    }
    void refreshHistorySnapshot();
  }, [activeView, activeSettingsPage, historySnapshot, historyLoading]);

  useEffect(() => {
    if (!visiblePanels.terminal) {
      return;
    }

    window.requestAnimationFrame(() => {
      const terminalBody = terminalBodyRef.current;
      if (terminalBody) {
        terminalBody.scrollTop = terminalBody.scrollHeight;
      }
      terminalInputRef.current?.focus();
    });
  }, [terminalEntries, terminalRunning, visiblePanels.terminal]);

  useEffect(() => {
    setPathInfoMap({});
    setExpandedResourceGroups({});
    setResourceContextMenu(null);
  }, [workspacePath]);

  useEffect(() => {
    if (!resourceContextMenu) {
      return;
    }

    const closeMenu = () => setResourceContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [resourceContextMenu]);

  useEffect(() => {
    if (!window.fiitx?.inspectPath) {
      return;
    }

    const paths = Array.from(new Set(messages.flatMap((message) => extractLocalPaths(message.body))));
    const unchecked = paths.filter((candidate) => !pathInfoMap[candidate]);
    if (unchecked.length === 0) {
      return;
    }

    let cancelled = false;
    Promise.all(
      unchecked.map(async (candidate) => {
        try {
          const info = await window.fiitx?.inspectPath(candidate, workspacePath);
          return info ? [candidate, info] as const : null;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setPathInfoMap((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (entry) {
            next[entry[0]] = entry[1];
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [messages, pathInfoMap, workspacePath]);

  function addAudit(actor: string, event: string, target: string, level: AuditLog["level"] = "info") {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: timeNow(),
      actor,
      event,
      target,
      level
    };
    setAuditLogs((current) => [log, ...current]);
  }

  async function refreshHistorySnapshot() {
    if (!window.fiitx?.getAgentHistorySnapshot) {
      return;
    }
    setHistoryLoading(true);
    try {
      const snapshot = await window.fiitx.getAgentHistorySnapshot({ limit: 1500 });
      setHistorySnapshot(snapshot);
      const fallbackThreadId = snapshot.activeThreadId || snapshot.threads[0]?.id || "";
      setSelectedHistoryThreadId((current) => current || fallbackThreadId);
      setCompareLeftThreadId((current) => current || fallbackThreadId);
      setCompareRightThreadId((current) => current || snapshot.threads.find((thread) => thread.id !== fallbackThreadId)?.id || fallbackThreadId);
      const allVersions = [...snapshot.promptVersions, ...snapshot.policyVersions];
      const firstVersionKey = allVersions[0] ? `${allVersions[0].id}:${allVersions[0].version}` : "";
      const secondVersion = allVersions.find((version) => `${version.id}:${version.version}` !== firstVersionKey);
      setVersionDiffLeftId((current) => current || firstVersionKey);
      setVersionDiffRightId((current) => current || (secondVersion ? `${secondVersion.id}:${secondVersion.version}` : firstVersionKey));
      if (fallbackThreadId && !historyTrace) {
        void openHistoryTrace(fallbackThreadId);
      }
    } catch (error) {
      addAudit("Agent History", "刷新失败", error instanceof Error ? error.message : "history snapshot failed", "warn");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistoryTrace(threadId: string) {
    if (!threadId || !window.fiitx?.getAgentTrace) {
      return;
    }
    setSelectedHistoryThreadId(threadId);
    setHistoryLoading(true);
    try {
      const trace = await window.fiitx.getAgentTrace({ threadId, limit: 1500 });
      setHistoryTrace(trace);
    } catch (error) {
      addAudit("Agent History", "Trace 加载失败", error instanceof Error ? error.message : threadId, "warn");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function compareHistoryRuns() {
    if (!compareLeftThreadId || !compareRightThreadId || !window.fiitx?.compareAgentRuns) {
      return;
    }
    setHistoryLoading(true);
    try {
      const result = await window.fiitx.compareAgentRuns({
        leftThreadId: compareLeftThreadId,
        rightThreadId: compareRightThreadId,
        limit: 1500
      });
      setHistoryCompare(result);
      addAudit("Agent History", "Run Compare", `${compareLeftThreadId} <-> ${compareRightThreadId}`, "info");
    } catch (error) {
      addAudit("Agent History", "Run Compare 失败", error instanceof Error ? error.message : "compare failed", "warn");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function exportHistoryAudit(threadId = selectedHistoryThreadId || activeThreadId) {
    if (!threadId || !window.fiitx?.exportAgentAuditPackage) {
      return;
    }
    setHistoryLoading(true);
    try {
      const result = await window.fiitx.exportAgentAuditPackage({ threadId, limit: 1500 });
      addAudit("Agent History", "导出审计包", result.path, result.ok ? "success" : "warn");
      if (result.ok) {
        void window.fiitx?.openContainingFolder?.(result.path);
      }
    } catch (error) {
      addAudit("Agent History", "导出审计包失败", error instanceof Error ? error.message : threadId, "warn");
    } finally {
      setHistoryLoading(false);
    }
  }

  function getTerminalWorkspaceLabel() {
    if (!workspacePath) {
      return PRODUCT_NAME;
    }
    return workspacePath.split("/").filter(Boolean).slice(-1)[0] || PRODUCT_NAME;
  }

  function createTerminalEntry(command: string): TerminalEntry {
    return {
      id: `terminal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      command,
      cwd: workspacePath || getTerminalWorkspaceLabel(),
      stdout: "",
      stderr: "",
      exitCode: null,
      status: "running",
      startedAt: Date.now()
    };
  }

  function resetTerminal() {
    setTerminalEntries([]);
    setTerminalCommand("");
    window.requestAnimationFrame(() => terminalInputRef.current?.focus());
  }

  async function runTerminalCommand(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const command = terminalCommand.trim();
    if (!command || terminalRunning) {
      return;
    }

    if (!window.fiitx?.runTerminalCommand) {
      const entry = {
        ...createTerminalEntry(command),
        status: "error" as const,
        exitCode: 1,
        stderr: "当前运行环境未暴露 Terminal IPC。",
        finishedAt: Date.now()
      };
      setTerminalEntries((current) => current.concat(entry));
      setTerminalCommand("");
      addAudit("Terminal", "命令失败", command, "warn");
      return;
    }

    const entry = createTerminalEntry(command);
    setTerminalEntries((current) => current.concat(entry));
    setTerminalCommand("");
    setTerminalRunning(true);

    try {
      const result = await window.fiitx.runTerminalCommand({
        command,
        workspacePath,
        timeoutMs: 120000
      });
      const exitCode = typeof result.exitCode === "number" ? result.exitCode : result.ok ? 0 : 1;
      setTerminalEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                cwd: result.cwd || item.cwd,
                stdout: result.stdout || "",
                stderr: result.stderr || "",
                exitCode,
                status: exitCode === 0 ? "success" : "error",
                finishedAt: Date.now()
              }
            : item
        )
      );
      addAudit("Terminal", exitCode === 0 ? "执行命令" : "命令失败", command, exitCode === 0 ? "success" : "warn");
    } catch (error) {
      const message = error instanceof Error ? error.message : "命令执行失败";
      setTerminalEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                stderr: message,
                exitCode: 1,
                status: "error",
                finishedAt: Date.now()
              }
            : item
        )
      );
      addAudit("Terminal", "命令失败", command, "warn");
    } finally {
      setTerminalRunning(false);
      window.requestAnimationFrame(() => terminalInputRef.current?.focus());
    }
  }

  function cleanPathCandidate(candidate: string) {
    return candidate
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/[.,，。；;:：）)\]\}*]+$/g, "");
  }

  function isLikelyLocalPath(candidate: string) {
    if (!candidate || candidate.includes("://")) {
      return false;
    }

    if (isShellCommandFragment(candidate)) {
      return false;
    }

    if (candidate.startsWith("/") || candidate.startsWith("~/") || candidate.startsWith("./") || candidate.startsWith("../")) {
      return true;
    }

    if (candidate.includes("/") && candidate.endsWith("/")) {
      return true;
    }

    if (/^\d+(?:\.\d+)+$/.test(candidate)) {
      return false;
    }

    if (!candidate.includes("/") && /\.[A-Za-z0-9]{1,12}$/.test(candidate)) {
      const extension = candidate.split(".").pop() || "";
      return /[A-Za-z]/.test(extension);
    }

    return /\.[A-Za-z0-9]{1,12}$/.test(candidate);
  }

  function isShellCommandFragment(candidate: string) {
    const value = candidate.trim();
    return (
      /(?:^|\s)(?:cd|python3?|node|npm|pnpm|yarn|git|open|cat|mkdir|touch|bash|sh)\s/i.test(value) ||
      /&&|\|\||[;<>]/.test(value)
    );
  }

  function isRevealableLocalPath(candidate: string) {
    return Boolean(candidate) && !/^(data|https?):/i.test(candidate);
  }

  function extractLocalPaths(text: string) {
    const paths = new Set<string>();
    const quotedPattern = /[`"']((?:~\/|\/|\.{1,2}\/)?(?:[^`"'\n]+\/)+[^`"'\n]+|(?:~\/|\/)[^`"'\n]+)[`"']/g;
    for (const match of text.matchAll(quotedPattern)) {
      paths.add(cleanPathCandidate(match[1]));
    }

    const quotedSimpleFilePattern = /[`"']([A-Za-z0-9_.@()+ -]+\.[A-Za-z0-9]{1,12})[`"']/g;
    for (const match of text.matchAll(quotedSimpleFilePattern)) {
      paths.add(cleanPathCandidate(match[1]));
    }

    const linePattern = /(^|[\s([{（：:])((?:~\/|\/)(?:Users|Volumes|Applications|tmp|var|private|opt|usr|Library|System)[^\n，。；;]*)/g;
    for (const match of text.matchAll(linePattern)) {
      paths.add(cleanPathCandidate(match[2]));
    }

    const relativeFilePattern = /(^|[\s([{（：:])((?!(?:https?|file):\/\/)(?:\.{1,2}\/)?(?:[A-Za-z0-9_.@+-]+\/)+[A-Za-z0-9_.@()+ -]+\.[A-Za-z0-9]{1,12})(?=$|[\s，。；;,）)\]\}])/g;
    for (const match of text.matchAll(relativeFilePattern)) {
      paths.add(cleanPathCandidate(match[2]));
    }

    const relativeDirectoryPattern = /(^|[\s([{（：:])((?:\.{1,2}\/)?(?:[A-Za-z0-9_.@+-]+\/)+)(?=$|[\s，。；;,）)\]\}])/g;
    for (const match of text.matchAll(relativeDirectoryPattern)) {
      paths.add(cleanPathCandidate(match[2]));
    }

    return Array.from(paths).filter((item) => item.length > 1 && !item.startsWith("//") && isLikelyLocalPath(item));
  }

  function getCurrentDateContext() {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Shanghai"
    }).format(new Date());
  }

  function buildPiContextMessages() {
    const transformed = messages.filter((message) => {
      if (message.approvalId) {
        return false;
      }
      if (message.role === "system" && /已(批准|拒绝)/.test(message.body)) {
        return true;
      }
      return message.role !== "system";
    });

    return transformed
      .slice(-14)
      .map((message) => ({
        role: message.role === "user" ? "user" as const : "assistant" as const,
        content: message.role === "user" ? message.body : stripAgentStreamSection(message.body),
        time: message.time
      }));
  }

  function clipThreadContext(value: string | undefined, limit = 1400) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }
    return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
  }

  function toThreadArtifactContext(file: FileArtifact) {
    return {
      path: file.path,
      title: file.title,
      language: file.language,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      preview: clipThreadContext(file.preview)
    };
  }

  function buildPiThreadContext(thread: Thread) {
    const folder =
      (thread.projectFolderId ? projectFoldersState.find((item) => item.id === thread.projectFolderId) : null) ??
      projectFoldersState.find((item) => item.threads.includes(thread.id)) ??
      null;
    const isCurrentWorkbench = thread.id === activeThreadId || activeThreadId === DRAFT_THREAD_ID;
    const record = isCurrentWorkbench ? null : normalizeThreadRecord(threadRecords[thread.id]);
    const threadArtifacts = isCurrentWorkbench ? artifacts : record?.artifacts ?? [];
    const threadExecutionArtifacts = isCurrentWorkbench ? executionArtifacts : record?.executionArtifacts ?? [];
    const threadLastArtifact = isCurrentWorkbench ? lastAgentArtifact : record?.lastAgentArtifact ?? null;
    const threadMessages = isCurrentWorkbench ? messages : record?.messages ?? [];
    const targetWorkspace = thread.workspacePath || folder?.path || workspacePath;
    const targetArtifact = threadLastArtifact ?? selectedFile ?? threadArtifacts[0] ?? threadExecutionArtifacts[0] ?? null;

    return {
      activeThread: {
        id: thread.id,
        title: thread.title,
        kind: thread.kind,
        status: thread.status,
        workspacePath: targetWorkspace
      },
      selectedProjectFolder: folder ? { id: folder.id, name: folder.name, path: folder.path || "" } : null,
      currentTarget: targetArtifact ? toThreadArtifactContext(targetArtifact) : null,
      selectedFile: selectedFile ? toThreadArtifactContext(selectedFile) : null,
      lastArtifact: threadLastArtifact ? toThreadArtifactContext(threadLastArtifact) : null,
      artifacts: threadArtifacts.slice(0, 8).map(toThreadArtifactContext),
      executionArtifacts: threadExecutionArtifacts.slice(0, 6).map(toThreadArtifactContext),
      recentMessages: threadMessages
        .filter((message) => !message.approvalId && message.role !== "system")
        .slice(-8)
        .map((message) => ({
          role: message.role === "user" ? "user" as const : "assistant" as const,
          author: message.author,
          content: clipThreadContext(message.role === "user" ? message.body : stripAgentStreamSection(message.body), 900),
          time: message.time
        }))
    };
  }

  function getArtifactExtension(file: FileArtifact) {
    const basename = file.path.split("?")[0].split("#")[0].split("/").pop() || "";
    const dotIndex = basename.lastIndexOf(".");
    const fromPath = dotIndex > 0 ? basename.slice(dotIndex + 1).toLowerCase() : "";
    const fromLanguage = file.language.replace(/^\./, "").toLowerCase();
    return fromPath || fromLanguage;
  }

  function getMediaKindFromExtension(extension: string) {
    const normalized = extension.replace(/^\./, "").toLowerCase();
    if (imageExtensions.has(normalized)) {
      return "image";
    }
    if (videoExtensions.has(normalized)) {
      return "video";
    }
    if (audioExtensions.has(normalized)) {
      return "audio";
    }
    if (htmlExtensions.has(normalized)) {
      return "html";
    }
    if (pdfExtensions.has(normalized)) {
      return "pdf";
    }
    return "";
  }

  function getMediaKindFromSource(source: string) {
    const dataMatch = /^data:([^;,]+)/i.exec(source);
    if (dataMatch) {
      const mime = dataMatch[1].toLowerCase();
      if (mime.startsWith("image/")) {
        return "image";
      }
      if (mime.startsWith("video/")) {
        return "video";
      }
      if (mime.startsWith("audio/")) {
        return "audio";
      }
      if (mime === "text/html") {
        return "html";
      }
    }

    const extension = source.split("?")[0].split("#")[0].split(".").pop() || "";
    return getMediaKindFromExtension(extension);
  }

  function getFileUrl(path: string) {
    if (/^(data|https?|file):/i.test(path)) {
      return path;
    }
    return encodeURI(`file://${path}`);
  }

  function getArtifactIdForFile(file: FileArtifact): ArtifactId {
    const extension = getArtifactExtension(file);
    if (["ppt", "pptx", "key"].includes(extension)) {
      return "ppt";
    }
    if (getMediaKindFromExtension(extension)) {
      return "image";
    }
    if (["md", "markdown", "txt", "doc", "docx", "pdf", "rtf"].includes(extension)) {
      return "report";
    }
    return "diff";
  }

  function formatFileSize(size = 0) {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function getPathFallbackName(candidate: string) {
    return candidate.replace(/\/+$/g, "").split("/").filter(Boolean).slice(-1)[0] || candidate;
  }

  function getPathKindLabel(info?: PathInfo) {
    if (!info) {
      return "检查中";
    }
    if (!info.exists) {
      return "未找到";
    }
    if (info.kind === "directory") {
      return info.resolvedFromWorkspace ? "文件夹 · workspace" : "文件夹";
    }
    if (info.kind === "file") {
      const sizeLabel = typeof info.size === "number" ? `文件 · ${formatFileSize(info.size)}` : "文件";
      return info.resolvedFromWorkspace ? `${sizeLabel} · workspace` : sizeLabel;
    }
    return "路径";
  }

  function normalizeFileExtension(value?: string) {
    return String(value || "").replace(/^\./, "").toLowerCase();
  }

  function getPathInfoExtension(info: PathInfo) {
    const fromInfo = normalizeFileExtension(info.extension);
    if (fromInfo) {
      return fromInfo;
    }
    const basename = info.path.split("?")[0].split("#")[0].split("/").pop() || "";
    return normalizeFileExtension(basename.includes(".") ? basename.split(".").pop() : "");
  }

  function isArtifactPreviewFile(info: PathInfo) {
    return info.exists && info.kind === "file" && artifactPreviewExtensions.has(getPathInfoExtension(info));
  }

  function isIdeOpenableFile(info: PathInfo) {
    return info.exists && info.kind === "file" && Boolean(info.previewable);
  }

  function getActiveWorkspaceRoot() {
    return activeThread.workspacePath || workspacePath;
  }

  function toWorkspaceRelativePath(filePath: string, rootPath = getActiveWorkspaceRoot()) {
    const root = String(rootPath || "").replace(/\\/g, "/").replace(/\/+$/g, "");
    const target = String(filePath || "").replace(/\\/g, "/");
    if (!target || !root) {
      return "";
    }
    if (!target.startsWith("/")) {
      return target.replace(/^\.{1,2}\//, "").replace(/^\/+/, "");
    }
    if (target === root) {
      return "";
    }
    if (!target.startsWith(`${root}/`)) {
      return "";
    }
    return target.slice(root.length + 1);
  }

  async function inspectMessagePath(path: string) {
    const cached = pathInfoMap[path];
    if (cached) {
      return cached;
    }

    const info = await window.fiitx?.inspectPath?.(path, workspacePath);
    if (info) {
      setPathInfoMap((current) => ({
        ...current,
        [path]: info
      }));
    }
    return info;
  }

  async function openLocalPath(path: string) {
    const result = await window.fiitx?.openPath?.(path, workspacePath);
    addAudit("Workspace Manager", result?.ok ? "打开路径" : "打开路径失败", path, result?.ok ? "success" : "warn");
  }

  async function openContainingFolder(path: string) {
    if (!isRevealableLocalPath(path)) {
      return;
    }

    const result = await window.fiitx?.openContainingFolder?.(path, workspacePath);
    addAudit(
      "Workspace Manager",
      result?.ok ? "打开所在位置" : "打开所在位置失败",
      path,
      result?.ok ? "success" : "warn"
    );
  }

  function showLocalFileArtifact(info: PathInfo, previewText?: string, options: { openPanel?: boolean } = {}) {
    const { openPanel = true } = options;
    const body = previewText || [
      `# ${info.name}`,
      "",
      `路径：${info.path}`,
      `类型：${info.extension || "文件"}`,
      `大小：${formatFileSize(info.size)}`,
      "",
      "当前文件类型暂不支持文本预览，可在 Finder 中打开。"
    ].join("\n");

    const artifact: FileArtifact = {
      path: info.path,
      title: info.name,
      language: info.extension?.replace(".", "") || "file",
      status: "added",
      additions: body.split("\n").length,
      deletions: 0,
      preview: body
    };
    updateArtifactsForThread(activeThreadId, (current) => [artifact, ...current.filter((item) => item.path !== artifact.path)], true);
    setThreadLastArtifact(activeThreadId, artifact, true);
    selectFileArtifact(artifact, { openPanel, mode: "preview" });
  }

  async function previewLocalPath(path: string, knownInfo?: PathInfo) {
    try {
      const preview = await window.fiitx?.previewPath?.(path, workspacePath);
      if (!preview) {
        return;
      }

      showLocalFileArtifact(preview, `${preview.content}${preview.truncated ? "\n\n[文件较大，已截断预览]" : ""}`);
      addAudit("Artifact Engine", "预览本地文件", preview.path, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "文件预览失败";
      if (knownInfo?.exists && knownInfo.kind === "file") {
        showLocalFileArtifact(knownInfo, [
          `# ${knownInfo.name}`,
          "",
          `路径：${knownInfo.path}`,
          `大小：${formatFileSize(knownInfo.size)}`,
          "",
          message
        ].join("\n"));
        addAudit("Artifact Engine", "打开文件 artifact", knownInfo.path, "warn");
        return;
      }
      addAudit("Artifact Engine", "预览本地文件失败", `${path}: ${message}`, "warn");
    }
  }

  async function openLocalPathInIde(path: string, knownInfo?: PathInfo) {
    try {
      const info = knownInfo ?? await inspectMessagePath(path);
      if (!info?.exists || info.kind !== "file") {
        addAudit("Workspace IDE", "无法打开代码", `${path}: 不是文件`, "warn");
        return false;
      }
      if (!isIdeOpenableFile(info)) {
        addAudit("Workspace IDE", "无法打开代码", `${info.path}: 当前文件类型不支持文本编辑`, "warn");
        return false;
      }

      const relativePath = toWorkspaceRelativePath(info.path);
      if (!relativePath) {
        addAudit("Workspace IDE", "无法打开代码", `${info.path}: 不在当前 workspace 内`, "warn");
        await openLocalPath(info.path);
        return false;
      }

      setSelectedWorkspaceFile({
        path: relativePath,
        requestId: Date.now() + Math.random()
      });
      setRightPaneMode("code");
      setVisiblePanels((current) => ({
        ...current,
        artifact: true
      }));
      addAudit("Workspace IDE", "打开代码", relativePath, "info");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "打开代码失败";
      addAudit("Workspace IDE", "打开代码失败", `${path}: ${message}`, "warn");
      return false;
    }
  }

  async function previewResourcePath(path: string) {
    try {
      const info = await inspectMessagePath(path);
      if (!info?.exists) {
        addAudit("Workspace Manager", "路径不存在", path, "warn");
        return;
      }

      if (info.kind === "directory") {
        await openLocalPath(info.path);
        return;
      }

      if (isArtifactPreviewFile(info)) {
        if (info.previewable) {
          await previewLocalPath(info.path, info);
        } else {
          showLocalFileArtifact(info);
        }
        return;
      }

      if (isIdeOpenableFile(info)) {
        await openLocalPathInIde(info.path, info);
        return;
      }

      showLocalFileArtifact(info);
    } catch (error) {
      const message = error instanceof Error ? error.message : "预览资源失败";
      addAudit("Artifact Engine", "预览资源失败", `${path}: ${message}`, "warn");
    }
  }

  async function activateLocalPath(path: string) {
    try {
      const info = await inspectMessagePath(path);
      if (!info?.exists) {
        addAudit("Workspace Manager", "路径不存在", path, "warn");
        return;
      }

      if (info.kind === "directory") {
        await openLocalPath(info.path);
        return;
      }

      if (info.kind === "file") {
        await previewResourcePath(info.path);
        return;
      }

      await openLocalPath(info.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : "打开路径失败";
      addAudit("Workspace Manager", "打开路径失败", `${path}: ${message}`, "warn");
    }
  }

  function renderInlineMessageText(text: string, paths: string[]) {
    if (paths.length === 0) {
      return <p className="message-text">{text}</p>;
    }

    const orderedPaths = paths.slice().sort((a, b) => b.length - a.length);
    const parts: ReactNode[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      let nextIndex = -1;
      let nextPath = "";

      for (const candidate of orderedPaths) {
        const index = text.indexOf(candidate, cursor);
        if (index !== -1 && (nextIndex === -1 || index < nextIndex || (index === nextIndex && candidate.length > nextPath.length))) {
          nextIndex = index;
          nextPath = candidate;
        }
      }

      if (nextIndex === -1) {
        parts.push(text.slice(cursor));
        break;
      }

      if (nextIndex > cursor) {
        parts.push(text.slice(cursor, nextIndex));
      }

      const info = pathInfoMap[nextPath];
      const isDirectory = info?.kind === "directory";
      parts.push(
        <button
          className={`inline-path-link ${info?.exists === false ? "missing" : ""}`}
          key={`${nextPath}-${cursor}`}
          onClick={() => activateLocalPath(nextPath)}
          title={info?.path || nextPath}
          type="button"
        >
          {isDirectory ? <FolderOpen size={13} /> : <FileText size={13} />}
          <span>{nextPath}</span>
        </button>
      );
      cursor = nextIndex + nextPath.length;
    }

    return <p className="message-text">{parts}</p>;
  }

  function toggleResourceGroup(groupKey: string) {
    setExpandedResourceGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  }

  function openResourceContextMenu(event: ReactMouseEvent, path: string, enabled: boolean) {
    event.preventDefault();
    event.stopPropagation();
    if (!enabled) {
      return;
    }
    setResourceContextMenu({
      path,
      x: Math.min(event.clientX, window.innerWidth - 210),
      y: Math.min(event.clientY, window.innerHeight - 132)
    });
  }

  function getResourcePathKey(path: string) {
    const info = pathInfoMap[path];
    const resolvedPath = info?.exists && info.path ? info.path : path;
    return resolvedPath.replace(/\\/g, "/").replace(/\/+$/g, "");
  }

  function dedupeResourcePaths(paths: string[]) {
    const seen = new Set<string>();
    const deduped: string[] = [];
    const sorted = paths.slice().sort((left, right) => {
      const leftExists = pathInfoMap[left]?.exists === true;
      const rightExists = pathInfoMap[right]?.exists === true;
      if (leftExists !== rightExists) {
        return leftExists ? -1 : 1;
      }
      return left.length - right.length;
    });

    for (const path of sorted) {
      const key = getResourcePathKey(path);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(path);
    }

    return deduped;
  }

  function renderPathResourceGroup(paths: string[]) {
    if (paths.length === 0) {
      return null;
    }

    const resourcePaths = dedupeResourcePaths(paths).filter((path) => pathInfoMap[path]?.exists === true);
    if (resourcePaths.length === 0) {
      return null;
    }

    const originalExistingCount = paths.filter((path) => pathInfoMap[path]?.exists === true).length;
    const duplicateCount = Math.max(originalExistingCount - resourcePaths.length, 0);
    const files = resourcePaths.filter((path) => pathInfoMap[path]?.kind === "file");
    const directories = resourcePaths.filter((path) => pathInfoMap[path]?.kind === "directory");
    const groupKey = `${resourcePaths.length}:${resourcePaths.slice(0, 6).map((path) => getResourcePathKey(path)).join("|")}`;
    const isExpanded = Boolean(expandedResourceGroups[groupKey]);
    const sortedPaths = resourcePaths.slice().sort((left, right) => {
      const leftExists = pathInfoMap[left]?.exists === true;
      const rightExists = pathInfoMap[right]?.exists === true;
      if (leftExists !== rightExists) {
        return leftExists ? -1 : 1;
      }
      return left.localeCompare(right);
    });
    const visiblePaths = isExpanded ? sortedPaths : sortedPaths.slice(0, 2);
    const hiddenCount = Math.max(resourcePaths.length - visiblePaths.length, 0);
    return (
      <div className="message-resource-card">
        <div className="resource-card-header">
          <div className="resource-card-icon">
            <FileText size={18} />
          </div>
          <div>
            <strong>本地资源</strong>
            <span>
              已识别 {resourcePaths.length} 个可用路径
              {` · ${files.length} 个文件 · ${directories.length} 个文件夹`}
              {duplicateCount > 0 ? ` · 已合并 ${duplicateCount} 个重复路径` : ""}
            </span>
          </div>
        </div>
        <div className="resource-list">
          {visiblePaths.map((path) => {
            const info = pathInfoMap[path];
            const isDirectory = info?.kind === "directory";
            const stateLabel = getPathKindLabel(info!);

            return (
              <div
                className="resource-row"
                key={path}
                onContextMenu={(event) => openResourceContextMenu(event, info?.path || path, true)}
                title={info?.path || path}
              >
                <button
                  className="resource-row-main"
                  onClick={() => activateLocalPath(path)}
                  type="button"
                >
                  <span className="resource-row-title">
                    {isDirectory ? <FolderOpen size={16} /> : <FileText size={16} />}
                    <strong>{info?.name || getPathFallbackName(path)}</strong>
                  </span>
                  <code>{info?.path || path}</code>
                </button>
                <span className="resource-row-meta">
                  <small>{stateLabel}</small>
                </span>
              </div>
            );
          })}
          {resourcePaths.length > 2 ? (
            <button className="resource-list-toggle" onClick={() => toggleResourceGroup(groupKey)} type="button">
              <span>{isExpanded ? "收起" : `再显示 ${hiddenCount} 个路径`}</span>
              <ChevronDown size={15} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function copyText(text: string) {
    void navigator.clipboard?.writeText(text);
    addAudit("Composer", "复制消息", `${text.length} chars`, "info");
  }

  function normalizeCodeLanguage(language: string) {
    const value = language.trim().toLowerCase();
    if (["shell", "zsh", "terminal"].includes(value)) {
      return "bash";
    }
    if (["jsx"].includes(value)) {
      return "javascript";
    }
    return value || "plaintext";
  }

  function getCodeBlockKind(language: string) {
    const normalized = normalizeCodeLanguage(language);
    if (normalized === "diff") {
      return "diff";
    }
    if (["bash", "sh", "shell"].includes(normalized)) {
      return "shell";
    }
    if (normalized === "json") {
      return "json";
    }
    return "code";
  }

  function highlightCode(code: string, language: string) {
    const normalized = normalizeCodeLanguage(language);
    if (normalized !== "plaintext" && hljs.getLanguage(normalized)) {
      return hljs.highlight(code, { language: normalized }).value;
    }
    return hljs.highlightAuto(code).value;
  }

  function renderCodeBlock(code: string, language: string, key: string) {
    const normalizedLanguage = normalizeCodeLanguage(language);
    const kind = getCodeBlockKind(normalizedLanguage);
    return (
      <div className={`code-block code-block-${kind}`} key={key}>
        <div className="code-block-header">
          <span>{normalizedLanguage === "plaintext" ? "code" : normalizedLanguage}</span>
          <button onClick={() => copyText(code)} title="复制代码">
            <Copy size={13} />
            <span>复制</span>
          </button>
        </div>
        <pre>
          <code dangerouslySetInnerHTML={{ __html: highlightCode(code, normalizedLanguage) }} />
        </pre>
      </div>
    );
  }

  function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }

      const token = match[0];
      const key = `${keyPrefix}-${match.index}`;
      if (token.startsWith("`") && token.endsWith("`")) {
        nodes.push(<code className="inline-code" key={key}>{token.slice(1, -1)}</code>);
      } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
        nodes.push(<strong key={key}>{renderInlineMarkdown(token.slice(2, -2), `${key}-strong`)}</strong>);
      } else if (match[2] && match[3]) {
        nodes.push(
          <a href={match[3]} key={key} rel="noreferrer" target="_blank">
            {renderInlineMarkdown(match[2], `${key}-link`)}
          </a>
        );
      } else {
        nodes.push(token);
      }

      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
  }

  function getVisualSourceMode(key: string) {
    return visualSourceModes[key] || "preview";
  }

  function setVisualSourceMode(key: string, mode: "preview" | "source") {
    setVisualSourceModes((current) => ({
      ...current,
      [key]: mode
    }));
  }

  function renderVisualSourceFrame({
    id,
    title,
    language,
    source,
    children
  }: {
    id: string;
    title: string;
    language: string;
    source: string;
    children: ReactNode;
  }) {
    const mode = getVisualSourceMode(id);
    return (
      <div className="visual-source-frame" key={id}>
        <div className="visual-source-header">
          <span>{title}</span>
          <div className="visual-source-actions">
            <button
              className={mode === "preview" ? "active" : ""}
              onClick={() => setVisualSourceMode(id, "preview")}
              type="button"
            >
              <Eye size={13} />
              <span>预览</span>
            </button>
            <button
              className={mode === "source" ? "active" : ""}
              onClick={() => setVisualSourceMode(id, "source")}
              type="button"
            >
              <FileText size={13} />
              <span>源码</span>
            </button>
            <button onClick={() => copyText(source)} title="复制源码" type="button">
              <Copy size={13} />
              <span>复制</span>
            </button>
          </div>
        </div>
        {mode === "preview" ? (
          <div className="visual-source-preview">{children}</div>
        ) : (
          <pre className="visual-source-code">
            <code dangerouslySetInnerHTML={{ __html: highlightCode(source, language) }} />
          </pre>
        )}
      </div>
    );
  }

  function parseMarkdownTable(lines: string[], startIndex: number) {
    const headerLine = lines[startIndex];
    const separatorLine = lines[startIndex + 1];
    if (!headerLine || !separatorLine || !headerLine.includes("|")) {
      return null;
    }
    if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separatorLine)) {
      return null;
    }

    const parseCells = (value: string) =>
      value
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());

    const headers = parseCells(headerLine);
    if (headers.length < 2) {
      return null;
    }

    const rows: string[][] = [];
    let index = startIndex + 2;
    while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
      const row = parseCells(lines[index]);
      if (row.length < 2) {
        break;
      }
      rows.push(row);
      index += 1;
    }

    return {
      headers,
      rows,
      source: lines.slice(startIndex, index).join("\n"),
      nextIndex: index
    };
  }

  function renderMarkdownTable(table: NonNullable<ReturnType<typeof parseMarkdownTable>>, key: string) {
    return renderVisualSourceFrame({
      id: key,
      title: "Markdown 表格",
      language: "markdown",
      source: table.source,
      children: (
        <div className="markdown-table-wrap">
          <table className="markdown-table">
            <thead>
              <tr>
                {table.headers.map((header, headerIndex) => (
                  <th key={`${header}-${headerIndex}`}>{renderInlineMarkdown(header, `${key}-th-${headerIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {table.headers.map((_, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>
                      {renderInlineMarkdown(row[cellIndex] || "", `${key}-td-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    });
  }

  function parseMermaidNode(raw: string) {
    const trimmed = raw.trim();
    const match = /^([A-Za-z0-9_]+)(?:\[(.*?)\]|\((.*?)\)|\{(.*?)\}|"(.*?)")?$/.exec(trimmed);
    if (!match) {
      return {
        id: trimmed,
        label: trimmed
      };
    }
    return {
      id: match[1],
      label: match[2] || match[3] || match[4] || match[5] || match[1]
    };
  }

  function parseMermaidFlow(code: string) {
    const nodes = new Map<string, string>();
    const edges: Array<{ from: string; to: string; label?: string }> = [];

    code
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        if (/^(graph|flowchart)\s+/i.test(line) || line.startsWith("%%")) {
          return;
        }
        const edgeMatch = /^(.+?)\s*[-=.]+(?:\|([^|]+)\|)?[->x.]+\s*(.+)$/.exec(line);
        if (edgeMatch) {
          const from = parseMermaidNode(edgeMatch[1]);
          const to = parseMermaidNode(edgeMatch[3]);
          nodes.set(from.id, from.label);
          nodes.set(to.id, to.label);
          edges.push({ from: from.id, to: to.id, label: edgeMatch[2] });
          return;
        }
        const node = parseMermaidNode(line);
        nodes.set(node.id, node.label);
      });

    return {
      nodes: Array.from(nodes.entries()).map(([id, label]) => ({ id, label })),
      edges
    };
  }

  function renderMermaidPreview(code: string, key: string) {
    const flow = parseMermaidFlow(code);
    return renderVisualSourceFrame({
      id: key,
      title: "流程图",
      language: "mermaid",
      source: code,
      children: flow.nodes.length > 0 ? (
        <div className="flowchart-preview">
          <div className="flowchart-nodes">
            {flow.nodes.map((node) => (
              <div className="flowchart-node" key={node.id}>
                <small>{node.id}</small>
                <span>{node.label}</span>
              </div>
            ))}
          </div>
          {flow.edges.length > 0 ? (
            <div className="flowchart-edges">
              {flow.edges.map((edge, edgeIndex) => (
                <div className="flowchart-edge" key={`${edge.from}-${edge.to}-${edgeIndex}`}>
                  <span>{edge.from}</span>
                  <b>{edge.label || "→"}</b>
                  <span>{edge.to}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="visual-source-empty">暂未识别出节点，切换到源码查看。</p>
      )
    });
  }

  function renderMediaPreview(source: string, title: string, key: string, htmlContent = "", sourceMarkdown = "") {
    const kind = getMediaKindFromSource(source) || (htmlContent ? "html" : "");
    const src = getFileUrl(source);
    const wrapMedia = (content: ReactNode, sourceLanguage = "markdown") =>
      sourceMarkdown
        ? renderVisualSourceFrame({
            id: `media-frame-${key}`,
            title: title || "媒体",
            language: sourceLanguage,
            source: sourceMarkdown,
            children: content
          })
        : content;

    if (kind === "image") {
      return wrapMedia(
        <figure className="media-preview media-preview-image" key={key}>
          <img src={src} alt={title || "图片预览"} />
          {title ? <figcaption>{title}</figcaption> : null}
        </figure>
      );
    }

    if (kind === "video") {
      return wrapMedia(
        <figure className="media-preview media-preview-video" key={key}>
          <video src={src} controls playsInline preload="metadata" />
          {title ? <figcaption>{title}</figcaption> : null}
        </figure>
      );
    }

    if (kind === "audio") {
      return wrapMedia(
        <figure className="media-preview media-preview-audio" key={key}>
          <audio src={src} controls preload="metadata" />
          {title ? <figcaption>{title}</figcaption> : null}
        </figure>
      );
    }

    if (kind === "html") {
      return wrapMedia(
        <div className="media-preview media-preview-html" key={key}>
          <div className="media-preview-header">
            <span>{title || "HTML 预览"}</span>
            <div className="media-preview-actions">
              {source && !htmlContent ? (
                <button onClick={() => openLocalPath(source)} type="button">
                  在浏览器打开
                </button>
              ) : null}
            </div>
          </div>
          <iframe
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            src={htmlContent ? undefined : src}
            srcDoc={htmlContent || undefined}
            title={title || "HTML 预览"}
          />
        </div>,
        "html"
      );
    }

    if (kind === "pdf") {
      return wrapMedia(
        <div className="media-preview media-preview-pdf" key={key}>
          <iframe src={src} title={title || "PDF 预览"} />
        </div>
      );
    }

    return null;
  }

  function renderMarkdownMediaLine(line: string, key: string) {
    const trimmed = line.trim();
    const imageMatch = /^!\[([^\]]*)\]\((.+)\)$/.exec(trimmed);
    if (imageMatch) {
      const title = imageMatch[1] || "媒体预览";
      const source = imageMatch[2].trim();
      return renderMediaPreview(source, title, key, "", trimmed);
    }

    const dataUriMatch = /^\(?\s*(data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+)\s*\)?$/i.exec(trimmed);
    if (dataUriMatch) {
      return renderMediaPreview(dataUriMatch[1], "内联媒体", key, "", trimmed);
    }

    const mediaUrlMatch = /^((?:https?|file):\/\/\S+\.(?:png|jpe?g|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg|m4a)(?:\?\S*)?)$/i.exec(trimmed);
    if (mediaUrlMatch) {
      return renderMediaPreview(mediaUrlMatch[1], mediaUrlMatch[1].split("/").pop() || "媒体预览", key, "", trimmed);
    }

    return null;
  }

  function renderMarkdownBlocks(text: string) {
    const blocks: ReactNode[] = [];
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push(<hr className="markdown-divider" key={`hr-${index}`} />);
        index += 1;
        continue;
      }

      const splitImageAlt = /^!\[([^\]]*)\]$/.exec(line.trim());
      const splitImageSource = splitImageAlt && lines[index + 1]
        ? /^\((data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+)\)$/i.exec(lines[index + 1].trim())
        : null;
      if (splitImageAlt && splitImageSource) {
        blocks.push(renderMediaPreview(splitImageSource[1], splitImageAlt[1] || "内联媒体", `media-split-${index}`, "", `${line.trim()}\n${lines[index + 1].trim()}`));
        index += 2;
        continue;
      }

      const mediaBlock = renderMarkdownMediaLine(line, `media-${index}`);
      if (mediaBlock) {
        blocks.push(mediaBlock);
        index += 1;
        continue;
      }

      if (line.startsWith("```")) {
        const language = line.replace(/^```/, "").trim();
        const codeLines: string[] = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) {
          codeLines.push(lines[index]);
          index += 1;
        }
        index += 1;
        const code = codeLines.join("\n");
        const normalizedLanguage = normalizeCodeLanguage(language);
        if (["mermaid", "flowchart"].includes(normalizedLanguage) || /^(graph|flowchart)\s+/i.test(code.trim())) {
          blocks.push(renderMermaidPreview(code, `flow-${index}`));
        } else if (["html", "svg"].includes(normalizedLanguage)) {
          const visual = renderMediaPreview("", normalizedLanguage === "svg" ? "SVG 预览" : "HTML 预览", `html-code-${index}`, code, `\`\`\`${language}\n${code}\n\`\`\``);
          blocks.push(visual || renderCodeBlock(code, language, `code-${index}`));
        } else {
          blocks.push(renderCodeBlock(code, language, `code-${index}`));
        }
        continue;
      }

      const table = parseMarkdownTable(lines, index);
      if (table) {
        blocks.push(renderMarkdownTable(table, `table-${index}`));
        index = table.nextIndex;
        continue;
      }

      const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = headingMatch[2];
        blocks.push(
          level === 1
            ? <h3 key={`h-${index}`}>{renderInlineMarkdown(content, `h-${index}`)}</h3>
            : <h4 key={`h-${index}`}>{renderInlineMarkdown(content, `h-${index}`)}</h4>
        );
        index += 1;
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
          index += 1;
        }
        blocks.push(
          <ul key={`ul-${index}`}>
            {items.map((item, itemIndex) => (
              <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}</li>
            ))}
          </ul>
        );
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ""));
          index += 1;
        }
        blocks.push(
          <ol key={`ol-${index}`}>
            {items.map((item, itemIndex) => (
              <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}</li>
            ))}
          </ol>
        );
        continue;
      }

      const paragraph: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !renderMarkdownMediaLine(lines[index], `media-probe-${index}`) &&
        !parseMarkdownTable(lines, index) &&
        !lines[index].startsWith("```") &&
        !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index]) &&
        !/^(#{1,3})\s+/.test(lines[index]) &&
        !/^\s*[-*]\s+/.test(lines[index]) &&
        !/^\s*\d+[.)]\s+/.test(lines[index])
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(paragraph.join(" "), `p-${index}`)}</p>);
    }

    return blocks;
  }

  function renderApprovalMessage(message: Message) {
    const approval = message.approvalId ? approvals.find((item) => item.id === message.approvalId) : null;
    if (!approval) {
      return null;
    }

    return (
      <div className={`inline-approval-card ${approval.status}`}>
        <div className="approval-risk">
          <ShieldCheck size={16} />
          <span>{riskLabel(approval.risk)}</span>
        </div>
        <div className="inline-approval-content">
          <strong>{approval.title}</strong>
          <p>{approval.detail}</p>
          <code>{approval.command}</code>
        </div>
        <div className="inline-approval-actions">
          <button className="icon-text-button success" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "approved")}>
            <Check size={15} />
            <span>同意</span>
          </button>
          <button className="icon-text-button danger" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "denied")}>
            <X size={15} />
            <span>拒绝</span>
          </button>
        </div>
      </div>
    );
  }

  function getMessageExecutionEvents(message: Message) {
    return getRenderableProgressEvents(message.streamEvents || []);
  }

  function toggleMessageExecutionDetails(messageId: string) {
    updateMessagesForThread(activeThreadId, (current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              streamDetailsExpanded: !message.streamDetailsExpanded
            }
          : message
      )
    , true, false);
  }

  function renderMessageExecutionProcess(message: Message) {
    const events = getMessageExecutionEvents(message);
    if (events.length === 0) {
      return null;
    }

    const expanded = Boolean(message.streamDetailsExpanded);
    const latest = events[events.length - 1];
    const hiddenCount = Math.max(0, events.length - inlineStreamEventLimit);
    const visibleEvents = events.slice(-inlineStreamEventLimit);
    const statusClass = message.streamStatus === "running" ? "running" : latest.status;
    const latestDetail = clipExecutionDetail(latest.detail, 120);
    const latestClock = formatProgressClock(latest.time);

    return (
      <div className={expanded ? "agent-message-execution expanded" : "agent-message-execution collapsed"}>
        <button
          className={`agent-message-execution-toggle ${statusClass}`}
          type="button"
          onClick={() => toggleMessageExecutionDetails(message.id)}
          aria-expanded={expanded}
        >
          {message.streamStatus === "running" ? <Brain size={15} /> : <Activity size={15} />}
          <span>执行过程</span>
          <small>
            {latestClock ? `${latestClock} ` : ""}
            {latest.title || "执行中"}
            {latestDetail ? `：${latestDetail}` : ""}
          </small>
          <ChevronDown size={15} />
        </button>

        {expanded ? (
          <div className="agent-message-execution-list">
            {hiddenCount > 0 ? <div className="agent-message-execution-hidden">已省略前 {hiddenCount} 步</div> : null}
            {visibleEvents.map((event) => {
              const eventClock = formatProgressClock(event.time);
              return (
                <div className={`agent-message-execution-step ${event.status}`} key={event.id}>
                  <span className="execution-dot" />
                  <div>
                    <strong>
                      {eventClock ? `${eventClock} ` : ""}
                      {event.title || "执行中"}
                    </strong>
                    {renderExecutionDetail(event.detail, event.id)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function renderMessageBody(message: Message) {
    const visibleBody = message.role === "user" ? message.body : stripAgentStreamSection(message.body);
    const paths = extractLocalPaths(visibleBody);
    const approvalCard = renderApprovalMessage(message);
    if (approvalCard) {
      return approvalCard;
    }

    if (message.role !== "user") {
      return (
        <>
          <div
            className={message.streamStatus === "running" ? "markdown-message agent-streaming-message" : "markdown-message"}
            aria-live={message.streamStatus === "running" ? "polite" : undefined}
          >
            {renderMarkdownBlocks(visibleBody)}
          </div>
          {renderMessageExecutionProcess(message)}
          {renderPathResourceGroup(paths)}
        </>
      );
    }

    return (
      <>
        <div className="user-message-content">
          {renderInlineMessageText(visibleBody, paths)}
        </div>
        {renderPathResourceGroup(paths)}
      </>
    );
  }

  function togglePanel(panel: PanelKey) {
    if (panel === "artifact" && visiblePanels.artifact) {
      setArtifactMaximized(false);
    }

    setVisiblePanels((current) => ({
      ...current,
      [panel]: !current[panel]
    }));
  }

  function selectFileArtifact(file: FileArtifact, options: { openPanel?: boolean; mode?: RightPaneMode } = {}) {
    const { openPanel = true, mode = "preview" } = options;
    setSelectedFile(file);
    setActiveArtifact(getArtifactIdForFile(file));
    setRightPaneMode(mode);
    if (openPanel) {
      setVisiblePanels((current) => ({
        ...current,
        artifact: true
      }));
    }
    addAudit("Artifact Engine", "打开文件 artifact", file.path, "info");
  }

  function openTaskThread(threadId: string, folderId: string | null = null) {
    const thread = threads.find((item) => item.id === threadId);
    cacheThreadRecord();
    setActiveThreadId(threadId);
    setSelectedProjectFolderId(folderId);
    const folderWorkspace = folderId ? projectFoldersState.find((folder) => folder.id === folderId)?.path : "";
    const nextWorkspace = thread?.workspacePath || folderWorkspace || workspacePath;
    if (nextWorkspace) {
      setWorkspacePath(nextWorkspace);
    }
    loadThreadRecordIntoWorkbench(threadId);
    setActiveView("workbench");
    if (thread) {
      addAudit("Workspace Manager", "打开任务线程", thread.title, "info");
    }
  }

  function toggleProjectFolder(folderId: string) {
    setSelectedProjectFolderId(folderId);
    setCollapsedProjectFolders((current) => ({
      ...current,
      [folderId]: !current[folderId]
    }));
  }

  function createBlankProject() {
    const id = `folder-blank-${Date.now()}`;
    setProjectFoldersState((current) =>
      current.concat({
        id,
        name: `空白项目 ${current.length + 1}`,
        threads: []
      })
    );
    setSelectedProjectFolderId(id);
    setProjectMenuOpen(false);
    addAudit("Workspace Manager", "新建空白项目", id, "success");
  }

  async function addExistingFolderProject() {
    const result = await window.fiitx?.chooseWorkspace();
    if (result && !result.canceled && result.filePaths[0]) {
      const selectedPath = result.filePaths[0];
      const folderName = selectedPath.split("/").filter(Boolean).slice(-1)[0] ?? selectedPath;
      const id = `folder-${pathSlug(selectedPath)}-${Date.now()}`;
      setWorkspacePath(selectedPath);
      setProjectFoldersState((current) =>
        current.concat({
          id,
          name: folderName,
          path: selectedPath,
          threads: []
        })
      );
      setSelectedProjectFolderId(id);
      addAudit("Workspace Manager", "使用现有文件夹", selectedPath, "success");
    }
    setProjectMenuOpen(false);
  }

  function selectAttachmentArtifact(path: string) {
    selectFileArtifact({
      path,
      title: path.split("/").pop() ?? path,
      language: "attachment",
      status: "added",
      additions: 1,
      deletions: 0,
      preview: `附件：${path}

${PRODUCT_NAME} 可以把附件作为 artifact 输入源处理：
- 摘要
- 提取结构
- 生成 Word/PPT
- 转换为任务上下文`
    });
  }

  async function addAttachments() {
    const result = await window.fiitx?.chooseFiles();
    const selectedFiles = result && !result.canceled ? result.filePaths : [];
    appendAttachments(selectedFiles, "选择附件");
  }

  function appendAttachments(paths: string[], source = "添加附件") {
    const nextFiles = paths.map((path) => path.trim()).filter(Boolean);
    if (nextFiles.length === 0) {
      return;
    }
    setAttachments((current) => Array.from(new Set(current.concat(nextFiles))));
    addAudit("Composer", source, `${nextFiles.length} file(s)`, "info");
  }

  function getPastedAttachmentName(file: File, index: number) {
    if (file.name) {
      return file.name;
    }
    const extensionFromMime = file.type.split("/")[1]?.replace(/[^a-z0-9.+-]/gi, "") || "bin";
    return `pasted-${Date.now()}-${index}.${extensionFromMime}`;
  }

  async function saveClipboardFile(file: File, index: number) {
    const localPath = (file as File & { path?: string }).path;
    if (localPath) {
      return localPath;
    }
    const buffer = await file.arrayBuffer();
    const result = await window.fiitx?.savePastedAttachment?.({
      name: getPastedAttachmentName(file, index),
      mimeType: file.type,
      buffer
    });
    if (!result?.ok || !result.path) {
      throw new Error("剪贴板附件保存失败");
    }
    return result.path;
  }

  async function handleComposerPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const clipboardFiles = Array.from(event.clipboardData.files || []);
    if (clipboardFiles.length === 0) {
      return;
    }

    event.preventDefault();
    try {
      const pastedPaths = await Promise.all(clipboardFiles.map((file, index) => saveClipboardFile(file, index)));
      appendAttachments(pastedPaths, "粘贴附件");
    } catch (error) {
      const message = error instanceof Error ? error.message : "粘贴附件失败";
      addAudit("Composer", "粘贴附件失败", message, "warn");
    }
  }

  function removeAttachment(path: string) {
    setAttachments((current) => current.filter((item) => item !== path));
  }

  function startVoiceInput() {
    setComposer((current) => {
      const nextText = "请根据语音输入整理任务目标，并生成可交付 artifact。";
      return current.trim() ? `${current.trim()}\n${nextText}` : nextText;
    });
    addAudit("Composer", "语音输入", "模拟语音转文字", "info");
  }

  async function chooseWorkspace() {
    const result = await window.fiitx?.chooseWorkspace();
    if (result && !result.canceled && result.filePaths[0]) {
      const selectedPath = result.filePaths[0];
      setWorkspacePath(selectedPath);
      if (isPersistableThread(activeThreadId)) {
        setThreads((current) =>
          current.map((thread) => (thread.id === activeThreadId ? { ...thread, workspacePath: selectedPath } : thread))
        );
      }
      addAudit("Workspace Manager", "选择工作区", selectedPath, "success");
    }
  }

  function createThread() {
    cacheThreadRecord();
    const nextThread = createTaskThread("", selectedProjectFolderId);
    loadThreadRecordIntoWorkbench(nextThread.id, {
      [nextThread.id]: emptyThreadRecord()
    });
    setSelectedFile(null);
    setActiveView("workbench");
    setMessages([]);
    addAudit("Workspace Manager", "创建任务线程", nextThread.title, "success");
  }

  function appendAuditEvents(events: FiitxAgentToolEvent[]) {
    const logs = events.map((event) => ({
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: timeNow(),
      actor: event.actor,
      event: event.event,
      target: event.target,
      level: event.level
    }));
    setAuditLogs((current) => logs.concat(current));
  }

  function appendApprovalRequests(requests: FiitxApprovalRequest[], resumePayload: FiitxAgentTaskPayload) {
    const nextApprovals: Approval[] = requests.map((request) => ({
      id: request.id || `approval-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: request.title,
      detail: request.detail,
      command: request.command,
      requester: request.requester,
      risk: request.risk,
      status: "pending" as const,
      action: request.action,
      resumePayload
    }));
    setApprovals((current) => nextApprovals.concat(current));
    updateMessagesForThread(resumePayload.threadId, (current) =>
      current.concat(
        nextApprovals.map((approval) => ({
          id: `message-approval-request-${approval.id}`,
          role: "system" as const,
          author: "Policy Engine",
          body: approval.detail,
          time: timeNow(),
          approvalId: approval.id
        }))
      ),
      resumePayload.threadId === activeThreadId
    );
    for (const approval of nextApprovals) {
      appendThreadSessionEntry(resumePayload.threadId, "approval", approval);
    }
  }

  function createLocalAgentPreview(payload: FiitxAgentTaskPayload): FiitxAgentTaskResult {
    const mode = inferAgentMode(payload.prompt, payload.attachments);
    const summary = `已接收任务：${payload.prompt}`;
    return {
      ok: true,
      summary,
      mode,
      model: payload.model,
      provider: "preview",
      title: buildFallbackTaskTitle(payload.prompt),
      artifact: {
        path: `artifacts/${Date.now()}-preview.md`,
        title: "preview.md",
        language: "markdown",
        status: "added",
        additions: 1,
        deletions: 0,
        preview: summary
      },
      toolEvents: []
    };
  }

  async function runAgentTask(payload: FiitxAgentTaskPayload) {
    if (window.fiitx?.promptAgent) {
      return window.fiitx.promptAgent(payload);
    }
    if (window.fiitx?.runAgentTask) {
      return window.fiitx.runAgentTask(payload);
    }
    return createLocalAgentPreview(payload);
  }

  function buildAgentRuntimePayload(prompt: string, taskId = `route-lab-${Date.now()}`): FiitxAgentTaskPayload {
    return {
      taskId,
      prompt,
      workspacePath: activeThread.workspacePath || workspacePath || "",
      model: getRuntimeModelId(),
      permissionMode,
      policySettings,
      attachments,
      threadId: activeThreadId,
      currentDate: getCurrentDateContext(),
      timeZone: "Asia/Shanghai",
      channelId: activeChannelAdapterId,
      channelContext: buildRuntimeChannelContext(activeThreadId),
      agentRegistry: buildRuntimeAgentRegistry(),
      channelRegistry: buildRuntimeChannelRegistry(),
      contextMessages: buildPiContextMessages(),
      threadContext: buildPiThreadContext(activeThread)
    };
  }

  async function runRouteLab(prompt = routeLabPrompt) {
    const trimmed = prompt.trim();
    if (!trimmed || routeLabLoading) {
      return;
    }
    setRouteLabLoading(true);
    try {
      const result = await window.fiitx?.inspectAgentRoute?.(buildAgentRuntimePayload(trimmed));
      if (result) {
        setRouteLabResult(result);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setRouteLabResult({
        prompt: trimmed,
        channelAdapter: null,
        intent: { mode: "chat", modality: "text", reason: detail },
        selectedAgent: null,
        agentCandidates: [],
        selectedModel: null,
        modelCandidates: [],
        toolPlan: [],
        policyPlan: [],
        contextPlan: { error: detail },
        deepseekHarnessChecks: ["route lab 调用失败"]
      });
    } finally {
      setRouteLabLoading(false);
    }
  }

  async function runAgentEvalHarness() {
    if (evalLoading) {
      return;
    }
    setEvalLoading(true);
    try {
      const result = await window.fiitx?.runAgentEval?.(buildAgentRuntimePayload(routeLabPrompt || "评估 Fiitx Agent 路由", `eval-${Date.now()}`));
      if (result) {
        setEvalResult(result);
      }
    } finally {
      setEvalLoading(false);
    }
  }

  async function refreshHarnessSnapshot() {
    if (harnessLoading) {
      return;
    }
    setHarnessLoading(true);
    try {
      const result = await window.fiitx?.getAgentHarnessSnapshot?.({ limit: 500 });
      if (result) {
        setHarnessSnapshot(result);
      }
    } finally {
      setHarnessLoading(false);
    }
  }

  function parseJsonRecordInput(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return {};
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${label} 必须是 JSON object`);
      }
      return parsed as Record<string, string>;
    } catch (error) {
      throw new Error(`${label} JSON 格式错误：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function parseMcpArgsInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      // Fall through to shell-like whitespace split for quick local setup.
    }
    return trimmed.split(/\s+/).filter(Boolean);
  }

  function editMcpServer(server: FiitxMcpServerConfig) {
    setMcpForm({
      ...server,
      type: server.type || "stdio",
      enabled: server.enabled !== false,
      risk: server.risk || "medium",
      timeoutMs: server.timeoutMs || 12000
    });
    setMcpArgsText(JSON.stringify(server.args || [], null, 2));
    setMcpEnvText(JSON.stringify(server.env || {}, null, 2));
    setMcpHeadersText(JSON.stringify(server.headers || {}, null, 2));
    setMcpStatusMessage(`正在编辑 ${server.id}`);
    setMcpFormOpen(true);
  }

  function resetMcpForm() {
    setMcpForm({
      id: "",
      name: "",
      type: "stdio",
      enabled: true,
      command: "",
      args: [],
      cwd: "",
      url: "",
      risk: "medium",
      timeoutMs: 12000
    });
    setMcpArgsText("");
    setMcpEnvText("{}");
    setMcpHeadersText("{}");
    setMcpStatusMessage("");
    setMcpFormOpen(false);
  }

  async function loadMcpManagement(refresh = false) {
    if (mcpLoading) {
      return;
    }
    setMcpLoading(true);
    try {
      const config = await window.fiitx?.getMcpConfig?.();
      if (config) {
        setMcpConfig(config);
      }
      if (refresh) {
        const snapshot = await window.fiitx?.refreshMcpRegistry?.();
        if (snapshot) {
          setMcpSnapshot(snapshot);
          setMcpStatusMessage(`已发现 ${snapshot.tools.length} 个 MCP 工具、${snapshot.resources.length} 个资源、${snapshot.prompts.length} 个 prompts`);
        }
      }
    } catch (error) {
      setMcpStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMcpLoading(false);
    }
  }

  async function saveMcpServerFromForm() {
    if (mcpLoading) {
      return;
    }
    const id = (mcpForm.id || "").trim();
    if (!id) {
      setMcpStatusMessage("MCP Server ID 不能为空");
      return;
    }
    setMcpLoading(true);
    try {
      const nextServer: FiitxMcpServerConfig = {
        ...mcpForm,
        id,
        name: (mcpForm.name || id).trim(),
        type: mcpForm.type || "stdio",
        enabled: mcpForm.enabled !== false,
        args: parseMcpArgsInput(mcpArgsText),
        env: parseJsonRecordInput(mcpEnvText, "Env"),
        headers: parseJsonRecordInput(mcpHeadersText, "Headers"),
        timeoutMs: Number(mcpForm.timeoutMs || 12000)
      };
      const config = await window.fiitx?.upsertMcpServer?.(nextServer);
      if (config) {
        setMcpConfig(config);
      }
      const snapshot = await window.fiitx?.refreshMcpRegistry?.();
      if (snapshot) {
        setMcpSnapshot(snapshot);
      }
      setMcpStatusMessage(`已保存 MCP Server：${nextServer.id}`);
      resetMcpForm();
    } catch (error) {
      setMcpStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMcpLoading(false);
    }
  }

  async function deleteMcpServer(id: string) {
    if (!id || mcpLoading) {
      return;
    }
    setMcpLoading(true);
    try {
      const config = await window.fiitx?.removeMcpServer?.({ id });
      if (config) {
        setMcpConfig(config);
      }
      const snapshot = await window.fiitx?.refreshMcpRegistry?.();
      if (snapshot) {
        setMcpSnapshot(snapshot);
      }
      setMcpStatusMessage(`已删除 MCP Server：${id}`);
    } catch (error) {
      setMcpStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMcpLoading(false);
    }
  }

  async function toggleMcpServerEnabled(server: FiitxMcpServerConfig, enabled: boolean) {
    if (!server.id || mcpLoading) {
      return;
    }
    setMcpLoading(true);
    try {
      const config = await window.fiitx?.upsertMcpServer?.({ ...server, enabled });
      if (config) {
        setMcpConfig(config);
      }
      const snapshot = await window.fiitx?.refreshMcpRegistry?.();
      if (snapshot) {
        setMcpSnapshot(snapshot);
      }
      setMcpStatusMessage(`${enabled ? "已启用" : "已停用"} MCP Server：${server.id}`);
    } catch (error) {
      setMcpStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMcpLoading(false);
    }
  }

  async function loadSkillManagement() {
    if (skillLoading) {
      return;
    }
    setSkillLoading(true);
    try {
      const [catalog, installed] = await Promise.all([
        window.fiitx?.listSkillCatalog?.(),
        window.fiitx?.listInstalledSkills?.()
      ]);
      setSkillCatalog(catalog || []);
      setInstalledSkills(installed || []);
      setSkillStatusMessage(`已加载 ${installed?.length || 0} 个已安装 Skill`);
    } catch (error) {
      setSkillStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSkillLoading(false);
    }
  }

  async function installSkill(root: string) {
    if (!root || skillLoading) {
      return;
    }
    setSkillLoading(true);
    try {
      await window.fiitx?.installLocalSkill?.({ root, enabled: true });
      const installed = await window.fiitx?.listInstalledSkills?.();
      setInstalledSkills(installed || []);
      setSkillInstallRoot("");
      setSkillStatusMessage(`已安装 Skill：${root}`);
      setHarnessSnapshot(null);
    } catch (error) {
      setSkillStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSkillLoading(false);
    }
  }

  async function uninstallSkill(id: string) {
    if (!id || skillLoading) {
      return;
    }
    setSkillLoading(true);
    try {
      await window.fiitx?.uninstallSkill?.({ id });
      const installed = await window.fiitx?.listInstalledSkills?.();
      setInstalledSkills(installed || []);
      setSkillStatusMessage(`已卸载 Skill：${id}`);
      setHarnessSnapshot(null);
    } catch (error) {
      setSkillStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSkillLoading(false);
    }
  }

  async function toggleInstalledSkill(id: string, enabled: boolean) {
    if (!id || skillLoading) {
      return;
    }
    setSkillLoading(true);
    try {
      await window.fiitx?.setSkillEnabled?.({ id, enabled });
      const installed = await window.fiitx?.listInstalledSkills?.();
      setInstalledSkills(installed || []);
      setSkillStatusMessage(`${enabled ? "已启用" : "已停用"} Skill：${id}`);
      setHarnessSnapshot(null);
    } catch (error) {
      setSkillStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSkillLoading(false);
    }
  }

  function inferAgentMode(prompt: string, files: string[] = []): "chat" | "coding" {
    const text = prompt.toLowerCase();
    const hasUrl = /https?:\/\/|(?:^|[\s，。；;])(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/|\b)/i.test(prompt);
    const creationIntent = /做|制作|生成|创建|搭建|开发|实现|复刻|仿照|设计|输出|写/.test(prompt);
    const interactiveArtifactIntent = [
      "小游戏",
      "游戏",
      "游览",
      "漫游",
      "导览",
      "场景",
      "主角",
      "角色",
      "npc",
      "交互",
      "互动",
      "three",
      "3d",
      "canvas",
      "地图",
      "关卡",
      "像素",
      "动画",
      "页面",
      "网站"
    ].some((signal) => text.includes(signal.toLowerCase()));
    const referenceDeliveryIntent = hasUrl && /参考|照着|仿照|复刻|风格|类似/.test(prompt) && creationIntent;
    const signals = [
      "代码",
      "项目",
      "文件",
      "目录结构",
      "开发",
      "实现",
      "修复",
      "bug",
      "build",
      "npm",
      "git",
      "app",
      "小程序",
      "网页",
      "组件",
      "接口",
      "脚本",
      "文档",
      "报告",
      "合同",
      "协议",
      "模板",
      "word",
      "docx",
      "doc",
      "pdf",
      "ppt",
      "pptx",
      "幻灯片",
      "生成文件",
      "写入",
      "保存",
      "导出"
    ];
    return files.length > 0 ||
      referenceDeliveryIntent ||
      (creationIntent && interactiveArtifactIntent) ||
      signals.some((signal) => text.includes(signal.toLowerCase()))
      ? "coding"
      : "chat";
  }

  function shouldSkipBusinessAgentForPrompt(prompt: string, files: string[] = []) {
    if (inferAgentMode(prompt, files) === "coding") {
      return true;
    }
    const text = prompt.toLowerCase();
    const isModelCenterPrompt =
      /(模型|model|profile|provider|api\s*key|apikey|key|base\s*url|baseurl|硅基流动|siliconflow|openrouter|deepseek-v4)/i.test(prompt) &&
      /(配置|保存|调用|路由|生成图片|生成视频|生成音频|可用|key|profile|模型|model)/i.test(prompt);
    const isDirectMediaPrompt = /(生成|画|做|输出).{0,16}(图片|图像|照片|视频|音频|语音)|图片生成|视频生成|音频生成/i.test(prompt);
    return isModelCenterPrompt || isDirectMediaPrompt || text.includes("siliconflow");
  }

  function agentLabel(mode: "chat" | "coding" | undefined) {
    return mode === "chat" ? "Chat Agent" : "Coding Agent";
  }

  const agentRouteHints: Record<string, string[]> = {
    "hotel-orchestrator": ["总控", "跨部门", "编排", "调度", "多系统", "工作流", "审批", "闭环", "分发"],
    "revenue-manager": ["收益", "房价", "调价", "价格", "房态", "库存", "入住率", "revpar", "adr", "渠道", "竞对", "促销"],
    "guest-service": ["前台", "住中", "入住", "续住", "换房", "加购", "预订", "订单", "客人问答", "服务请求"],
    "complaint-recovery": ["客诉", "投诉", "差评", "异味", "房间异味", "补救", "安抚", "赔付", "退款", "不满", "抱怨", "道歉", "升级投诉"],
    "marketing-content": ["营销", "活动", "文案", "海报", "小红书", "公众号", "短视频", "私域", "套餐", "推广"],
    "concierge-trip": ["礼宾", "行程", "攻略", "文旅", "景点", "餐厅", "票务", "路线", "亲子", "目的地", "住客", "两天一晚", "北京", "海淀", "周边游"],
    "ops-quality": ["质检", "巡检", "sop", "卫生", "设备", "能耗", "维修", "清洁", "客房检查", "运营"]
  };

  function normalizeRouteText(value: string) {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function scoreAgentForPrompt(agent: AgentSpec, prompt: string, channelId = activeChannelAdapterId) {
    if (agent.status === "draft") {
      return 0;
    }
    if (shouldSkipBusinessAgentForPrompt(prompt)) {
      return 0;
    }

    const text = normalizeRouteText(prompt);
    const channelAdapter = channelAdapters.find((adapter) => adapter.id === channelId);
    const hints = agentRouteHints[agent.id] ?? [];
    let semanticScore = 0;
    for (const hint of hints) {
      if (text.includes(hint.toLowerCase())) {
        semanticScore += hint.length >= 3 ? 8 : 5;
      }
    }

    const searchable = [
      agent.name,
      agent.scope,
      agent.objective,
      agent.systemPrompt,
      ...agent.triggers,
      ...agent.systems,
      ...agent.tools,
      ...agent.skills,
      ...agent.channels,
      ...agent.metrics
    ];
    for (const item of searchable) {
      const normalized = normalizeRouteText(item);
      if (normalized.length >= 2 && text.includes(normalized)) {
        semanticScore += 3;
      }
    }

    if (semanticScore <= 0) {
      return 0;
    }

    const channelBoost = channelAdapter?.agentBindings.includes(agent.id)
      ? channelAdapter.channelType === "wechat-miniprogram-ai" ? 14 : 6
      : 0;

    return semanticScore + channelBoost;
  }

  function matchAgentSpecForPrompt(prompt: string, channelId = activeChannelAdapterId) {
    const ranked = agentSpecs
      .map((agent) => ({ agent, score: scoreAgentForPrompt(agent, prompt, channelId) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= 5 ? ranked[0].agent : null;
  }

  function buildRuntimeAgentRegistry(): FiitxRuntimeAgentSpec[] {
    return agentSpecs.map((agent) => ({
      id: agent.id,
      name: agent.name,
      scope: agent.scope,
      objective: agent.objective,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      status: agent.status,
      tools: agent.tools,
      skills: agent.skills,
      triggers: agent.triggers,
      systems: agent.systems,
      stages: agent.stages,
      metrics: agent.metrics,
      channels: agent.channels,
      policy: agent.policy
    }));
  }

  function buildRuntimeChannelRegistry(): FiitxChannelAdapterSpec[] {
    return channelAdapters.map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      channelType: adapter.channelType,
      description: adapter.description,
      transport: adapter.transport,
      entrypoint: adapter.entrypoint,
      sessionKeyStrategy: adapter.sessionKeyStrategy,
      status: adapter.status,
      capabilities: adapter.capabilities,
      contextSources: adapter.contextSources,
      outputModes: adapter.outputModes,
      followUpPolicy: adapter.followUpPolicy,
      agentBindings: adapter.agentBindings,
      systemPrompt: adapter.systemPrompt,
      sampleEvent: adapter.sampleEvent
    }));
  }

  function buildRuntimeChannelContext(threadId: string) {
    const adapter = activeChannelAdapter ?? channelAdapters[0];
    const currentProjectFolder = selectedProjectFolderId
      ? projectFoldersState.find((item) => item.id === selectedProjectFolderId) ?? null
      : null;
    if (!adapter) {
      return undefined;
    }

    if (adapter.channelType === "wechat-miniprogram-ai") {
      return {
        channelId: adapter.id,
        conversationId: `wx-${threadId}`,
        messageId: `wx-msg-${Date.now()}`,
        senderId: "openid-demo",
        senderName: "微信住客",
        tenantId: currentProjectFolder?.name || "hotel-demo",
        appId: "wx-clawbot-simulator",
        pagePath: "/pages/ai/chat",
        scene: "workbench-simulator",
        eventType: "message",
        replyStyle: "wechat-mini-program",
        metadata: {
          source: "deepsix-workbench",
          simulator: true,
          workspacePath: activeThread.workspacePath || workspacePath || ""
        }
      } satisfies FiitxChannelContext;
    }

    return {
      channelId: adapter.id,
      conversationId: threadId,
      messageId: `desktop-msg-${Date.now()}`,
      senderId: "desktop-user",
      senderName: "工作台用户",
      eventType: "prompt",
      replyStyle: "desktop-rich",
      metadata: {
        source: "deepsix-workbench",
        simulator: false,
        workspacePath: activeThread.workspacePath || workspacePath || ""
      }
    } satisfies FiitxChannelContext;
  }

  function updateMessagesForThread(
    threadId: string,
    updater: Message[] | ((current: Message[]) => Message[]),
    display = threadId === activeThreadId,
    recordSession = true
  ) {
    let nextMessagesForEntry: Message[] = [];
    if (display) {
      setMessages((current) => {
        const next = applyStateUpdate(current, updater);
        nextMessagesForEntry = next.slice(current.length);
        return next;
      });
    }
    updateThreadRecord(threadId, (record) => ({
      ...(recordSession
        ? appendSessionEntryToRecord(record, "message", {
            messages: (nextMessagesForEntry.length > 0 ? nextMessagesForEntry : applyStateUpdate(record.messages, updater).slice(record.messages.length))
          })
        : record),
      messages: applyStateUpdate(record.messages, updater)
    }));
  }

  function updateArtifactsForThread(threadId: string, updater: FileArtifact[] | ((current: FileArtifact[]) => FileArtifact[]), display = threadId === activeThreadId) {
    if (display) {
      setArtifacts((current) => applyStateUpdate(current, updater));
    }
    updateThreadRecord(threadId, (record) => ({
      ...appendSessionEntryToRecord(record, "artifact", {
        artifacts: applyStateUpdate(record.artifacts, updater).slice(0, 3)
      }),
      artifacts: applyStateUpdate(record.artifacts, updater)
    }));
  }

  function setThreadLastArtifact(threadId: string, artifact: FileArtifact | null, display = threadId === activeThreadId) {
    if (display) {
      setLastAgentArtifact(artifact);
    }
    updateThreadRecord(threadId, (record) => ({
      ...record,
      lastAgentArtifact: artifact
    }));
  }

  function setThreadExecutionArtifacts(threadId: string, nextArtifacts: FileArtifact[], display = threadId === activeThreadId) {
    if (display) {
      setExecutionArtifacts(nextArtifacts);
    }
    updateThreadRecord(threadId, (record) => ({
      ...record,
      executionArtifacts: nextArtifacts
    }));
  }

  function recordAgentProgress(
    taskId: string,
    title: string,
    detail: string,
    status: FiitxAgentProgress["status"] = "running",
    threadId = activeThreadId,
    display = threadId === activeThreadId
  ) {
    const event: FiitxAgentProgress = {
      id: `progress-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      taskId,
      threadId,
      title,
      detail,
      status,
      time: new Date().toISOString()
    };

    if (display) {
      setAgentProgressEvents((current) => current.concat(event).slice(-64));
      setMessages((current) => applyAgentStreamEventToMessages(current, event));
    }
    updateThreadRecord(threadId, (record) => ({
      ...appendSessionEntryToRecord(record, "progress", event),
      messages: applyAgentStreamEventToMessages(record.messages, event),
      progressEvents: record.progressEvents.concat(event).slice(-64)
    }));
  }

  function formatElapsed(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  function getExecutionElapsedLabel() {
    if (!executionStartedAt) {
      return "";
    }
    const end = agentRunning ? statusNow : executionFinishedAt || statusNow;
    return formatElapsed(end - executionStartedAt);
  }

  function getExecutionStatusLabel() {
    if (agentRunning) {
      const title = latestProgress?.title || "";
      return title.includes("Pi Agent") || title.includes("Model") || title.includes("Intent") ? "正在思考" : "处理中";
    }
    if (activeThread.status === "waiting" && pendingApprovalCount > 0) {
      return "等待审批";
    }
    if (activeThread.status === "waiting" || latestProgress?.status === "warn") {
      return "未完成";
    }
    return "已处理";
  }

  function getExecutionStatusClass() {
    if (agentRunning) {
      return "running";
    }
    if (activeThread.status === "waiting" && pendingApprovalCount > 0) {
      return "warn";
    }
    if (activeThread.status === "waiting" || latestProgress?.status === "warn") {
      return "warn";
    }
    return "done";
  }

  function stripMarkdownForSummary(value?: string) {
    return String(value || "")
      .replace(/```[\s\S]*?```/g, " 代码块 ")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/^\s*\d+[.)]\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, " ")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatExecutionDetail(value?: unknown) {
    if (value == null) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function clipExecutionDetail(value?: unknown, limit = 170) {
    const normalized = stripMarkdownForSummary(formatExecutionDetail(value));
    if (!normalized) {
      return "";
    }
    return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
  }

  function stripAgentStreamSection(value?: string) {
    return String(value || "")
      .replace(/\n{0,2}---\n\n### (?:实时执行|执行过程)[\s\S]*$/m, "")
      .trim();
  }

  function formatProgressClock(value?: string) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  }

  function normalizeProgressEvent(event: unknown, index: number): FiitxAgentProgress {
    const record = isRecord(event) ? event : {};
    const rawStatus = String(record.status || "info");
    const status: FiitxAgentProgress["status"] =
      rawStatus === "running" || rawStatus === "success" || rawStatus === "warn" || rawStatus === "info" ? rawStatus : "info";
    const detail = formatExecutionDetail(record.detail).trim();
    const time = typeof record.time === "string" && record.time ? record.time : new Date().toISOString();
    const rawTitle = typeof record.title === "string" ? record.title.trim() : "";
    const title = rawTitle || (detail ? "执行中" : "");
    const taskId = typeof record.taskId === "string" ? record.taskId : "";
    const id = typeof record.id === "string" && record.id ? record.id : `progress-${taskId || "unknown"}-${time}-${index}`;
    return {
      id,
      taskId,
      threadId: typeof record.threadId === "string" ? record.threadId : undefined,
      title,
      detail,
      status,
      time
    };
  }

  function dedupeProgressEvents(events: unknown[]) {
    const seen = new Set<string>();
    return (Array.isArray(events) ? events : []).map(normalizeProgressEvent).filter((event) => {
      const key = event.id || `${event.taskId}:${event.title}:${event.detail}:${event.time}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function getRenderableProgressEvents(events: unknown[]) {
    return dedupeProgressEvents(events).filter((event) => {
      const title = stripMarkdownForSummary(event.title);
      const detail = stripMarkdownForSummary(event.detail);
      return Boolean(title || detail);
    });
  }

  function buildAgentStreamingBody(baseBody: string, _events: FiitxAgentProgress[], _status: Message["streamStatus"] = "running") {
    const cleanBase = stripAgentStreamSection(baseBody) || "正在执行任务。";
    return cleanBase;
  }

  function applyAgentStreamEventToMessages(current: Message[], event: FiitxAgentProgress) {
    if (!event.taskId) {
      return current;
    }

    const targetIndex = (() => {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const message = current[index];
        if (message.role === "agent" && message.taskId === event.taskId) {
          return index;
        }
      }
      return -1;
    })();

    if (targetIndex < 0) {
      return current;
    }

    return current.map((message, index) => {
      if (index !== targetIndex) {
        return message;
      }

      const streamEvents = dedupeProgressEvents([...(message.streamEvents || []), event]).slice(-64);
      const baseBody = message.streamBaseBody || stripAgentStreamSection(message.body);
      const streamStatus = message.streamStatus || "running";
      return updateAgentStreamMessageBody(
        {
          ...message,
          streamEvents
        },
        baseBody,
        streamStatus
      );
    });
  }

  function updateAgentStreamMessageBody(message: Message, body: string, streamStatus: Message["streamStatus"] = "running") {
    const streamEvents = dedupeProgressEvents(message.streamEvents || []).slice(-64);
    return {
      ...message,
      streamBaseBody: body,
      streamEvents,
      streamStatus,
      body: buildAgentStreamingBody(body, streamEvents, streamStatus)
    };
  }

  function finalizeAgentStreamMessage(message: Message, body: string) {
    return updateAgentStreamMessageBody(message, body, "finished");
  }

  function splitAgentFinalStreamText(value: string) {
    const text = stripAgentStreamSection(value) || "Agent 没有返回可展示内容。";
    const chunkSize = Math.max(72, Math.ceil(text.length / 180));
    const chunks: string[] = [];
    for (let index = 0; index < text.length; index += chunkSize) {
      chunks.push(text.slice(index, index + chunkSize));
    }
    return chunks.length > 0 ? chunks : [text];
  }

  function waitForAgentFinalStreamFrame() {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, 14);
    });
  }

  async function streamAgentFinalMessage({
    threadId,
    agentMessageId,
    author,
    body,
    display = threadId === activeThreadId
  }: {
    threadId: string;
    agentMessageId: string;
    author?: string;
    body: string;
    display?: boolean;
  }) {
    const chunks = splitAgentFinalStreamText(body);
    const finalBody = chunks.join("");

    if (!display || chunks.length <= 1) {
      updateMessagesForThread(threadId, (current) =>
        current.map((message) =>
          message.id === agentMessageId
            ? finalizeAgentStreamMessage(
                {
                  ...message,
                  author: author || message.author
                },
                finalBody
              )
            : message
        )
      , display);
      return;
    }

    let nextBody = "";
    for (const chunk of chunks) {
      nextBody += chunk;
      updateMessagesForThread(threadId, (current) =>
        current.map((message) =>
          message.id === agentMessageId
            ? updateAgentStreamMessageBody(
                {
                  ...message,
                  author: author || message.author
                },
                nextBody,
                "running"
              )
            : message
        )
      , true, false);
      await waitForAgentFinalStreamFrame();
    }

    updateMessagesForThread(threadId, (current) =>
      current.map((message) =>
        message.id === agentMessageId
          ? finalizeAgentStreamMessage(
              {
                ...message,
                author: author || message.author
              },
              finalBody
            )
          : message
      )
    , true);
  }

  function renderExecutionDetail(detail: unknown, key: string) {
    const normalized = formatExecutionDetail(detail).trim();
    if (!normalized) {
      return null;
    }

    return (
      <div className="execution-detail markdown-message" key={`detail-${key}`}>
        {renderMarkdownBlocks(normalized)}
      </div>
    );
  }

  function getLatestEditSummary() {
    if (executionArtifacts.length === 0) {
      return null;
    }

    return {
      count: executionArtifacts.length,
      additions: executionArtifacts.reduce((sum, file) => sum + file.additions, 0),
      deletions: executionArtifacts.reduce((sum, file) => sum + file.deletions, 0)
    };
  }

  function openLatestAgentResult() {
    if (lastAgentArtifact) {
      selectFileArtifact(lastAgentArtifact);
    }
  }

  function renderExecutionActivity() {
    const renderableProgress = getRenderableProgressEvents(visibleAgentProgress);
    if (renderableProgress.length === 0) {
      return null;
    }

    const executionElapsed = getExecutionElapsedLabel();
    const executionStatus = getExecutionStatusLabel();
    const editSummary = getLatestEditSummary();
    const latestDetail = clipExecutionDetail(latestProgress?.detail);

    return (
      <article className="execution-message" aria-live={agentRunning ? "polite" : "off"}>
        <div className="execution-message-gutter">
          {agentRunning ? <Brain size={16} /> : <Check size={16} />}
        </div>
        <div className={executionExpanded ? "execution-card inline expanded" : "execution-card inline collapsed"}>
          <button
            className={`execution-status-pill ${getExecutionStatusClass()}`}
            type="button"
            onClick={() => setExecutionExpanded((current) => !current)}
            aria-expanded={executionExpanded}
          >
            <span>
              {executionStatus}
              {executionElapsed ? ` ${executionElapsed}` : ""}
            </span>
            <ChevronDown size={16} />
          </button>

          <div className="execution-summary">
            <div className="execution-summary-row execution-live-row">
              {agentRunning ? <Brain size={15} /> : <Activity size={15} />}
              <span>{latestProgress?.title ?? (agentRunning ? "正在思考" : "执行完成")}</span>
              {latestDetail ? <small>{latestDetail}</small> : null}
            </div>

            {editSummary ? (
              <button
                className="execution-summary-row execution-summary-button"
                type="button"
                onClick={openLatestAgentResult}
                disabled={!lastAgentArtifact}
                title="查看执行结果"
              >
                <FileText size={15} />
                <span>已编辑 {editSummary.count} 个文件</span>
                <code>
                  +{editSummary.additions} -{editSummary.deletions}
                </code>
              </button>
            ) : null}
          </div>

          {executionExpanded ? (
            <div className="execution-list">
              {lastAgentArtifact ? (
                <button className="execution-result-button" onClick={openLatestAgentResult} type="button">
                  <PanelRight size={15} />
                  <span>查看执行结果</span>
                </button>
              ) : null}
              {renderableProgress.map((event) => (
                <div className={`execution-step ${event.status}`} key={event.id}>
                  <span className="execution-dot" />
                  <div>
                    <strong>{event.title}</strong>
                    {renderExecutionDetail(event.detail, event.id)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function getCurrentThreadFolderId(threadId: string) {
    return projectFoldersState.find((folder) => folder.threads.includes(threadId))?.id ?? null;
  }

  function getManualModelProfile() {
    return profiles[0] ?? null;
  }

  function getRuntimeModelId() {
    return autoModelRouting ? AUTO_MODEL : getManualModelProfile()?.id ?? AUTO_MODEL;
  }

  function getRuntimeModelLabel() {
    const profile = getManualModelProfile();
    return autoModelRouting ? AUTO_MODEL_LABEL : profile ? `${profile.provider} / ${profile.model}` : AUTO_MODEL_LABEL;
  }

  function upsertConfiguredProfile(profile: FiitxModelProfile) {
    setProfiles((current) => [
      profile,
      ...current.filter(
        (item) =>
          item.id !== profile.id &&
          !(item.provider === profile.provider && item.model === profile.model)
      )
    ]);
  }

  function createChatConfiguredProfile(payload: FiitxModelPayload): FiitxModelProfile {
    return {
      id: payload.id ?? `chat-${Date.now()}`,
      provider: payload.provider,
      model: payload.model,
      baseUrl: payload.baseUrl,
      apiKeyRef: `keychain:${payload.provider}:${payload.model}`,
      contextWindow: payload.contextWindow,
      supportsTools: payload.supportsTools,
      supportsVision: payload.supportsVision,
      supportsStreaming: payload.supportsStreaming,
      supportsJsonMode: payload.supportsJsonMode,
      bestFor: payload.bestFor,
      toolCallStyle: payload.toolCallStyle,
      updatedAt: new Date().toISOString()
    };
  }

  async function handleModelConfigurationMessage(body: string, visibleBody: string) {
    if (attachments.length > 0) {
      return false;
    }

    const explicitConfiguration = hasExplicitModelConfigSignal(body);
    const bareConfigValue = looksLikeBareModelConfigValue(body);
    const modelConfigContinuation = activeThread.kind === "Model Config" && (explicitConfiguration || bareConfigValue);
    if (hasNaturalTaskSignal(body) && !explicitConfiguration && !modelConfigContinuation) {
      return false;
    }

    const intent = buildModelPayloadFromChat(body, modelConfigContinuation || explicitConfiguration ? messages : []);
    const exactModelOrProvider =
      body.trim().length <= 120 &&
      Boolean(intent.provider || intent.model) &&
      !/[，。！？!?]/.test(body.trim()) &&
      bareConfigValue &&
      !hasNaturalTaskSignal(body);

    if (!intent.hasConfigurationSignal || (!explicitConfiguration && !exactModelOrProvider && !modelConfigContinuation)) {
      return false;
    }

    const redactedBody = redactSecrets(visibleBody || body);
    const labelBase = intent.provider || intent.model || "模型";
    const runtimeThread =
      activeThread.id === DRAFT_THREAD_ID
        ? createTaskThread(`配置 ${labelBase} profile`, selectedProjectFolderId)
        : activeThread;
    const taskId = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const startedAt = Date.now();
    const finishedAt = Date.now();
    const missing = [
      !intent.provider ? "供应商/provider" : "",
      !intent.model ? "模型/model" : "",
      !intent.apiKey ? "API Key" : "",
      !intent.baseUrl ? "Base URL" : ""
    ].filter(Boolean);

    setComposer("");
    setAttachments([]);
    setActiveAgentTaskId(taskId);
    setAgentProgressEvents([]);
    setLastAgentArtifact(null);
    setExecutionArtifacts([]);
    setExecutionStartedAt(startedAt);
    setExecutionFinishedAt(finishedAt);
    setStatusNow(finishedAt);
    setExecutionExpanded(false);
    updateThreadRecord(runtimeThread.id, (record) => ({
      ...record,
      activeAgentTaskId: taskId,
      progressEvents: [],
      lastAgentArtifact: null,
      executionArtifacts: [],
      executionStartedAt: startedAt,
      executionFinishedAt: finishedAt,
      executionExpanded: false
    }));
    recordAgentProgress(
      taskId,
      missing.length === 0 ? "模型配置完成" : "模型配置待补齐",
      missing.length === 0 ? `${intent.provider} / ${intent.model}` : `还缺：${missing.join("、")}`,
      missing.length === 0 ? "success" : "warn",
      runtimeThread.id,
      true
    );

    updateMessagesForThread(runtimeThread.id, (current) => [
      ...current,
      {
        id: `message-user-${Date.now()}`,
        role: "user",
        author: "你",
        body: redactedBody,
        time: timeNow()
      }
    ], true);

    if (missing.length > 0) {
      const nextStep =
        missing.includes("API Key")
          ? `请继续发送 ${intent.provider || "供应商"} 的 API Key。`
          : "请继续补充 provider、model 或 Base URL，例如：DeepSeek / deepseek-v4-flash / https://api.deepseek.com。";
      updateMessagesForThread(runtimeThread.id, (current) => [
        ...current,
        {
          id: `message-agent-${Date.now()}`,
          role: "agent",
          author: "Model Center",
          body: `我识别到你在配置模型 profile，但信息还不完整。\n\n已识别：\n- Provider：${intent.provider || "未识别"}\n- Model：${intent.model || "未识别"}\n- Base URL：${intent.baseUrl || "未识别"}\n- API Key：${intent.apiKey ? maskSecret(intent.apiKey) : "未提供"}\n\n${nextStep}`,
          time: timeNow()
        }
      ], true);
      renameThread(runtimeThread.id, `配置 ${labelBase} profile`);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === runtimeThread.id
            ? { ...thread, kind: "Model Config", model: AUTO_MODEL_LABEL, status: "waiting", updatedAt: "刚刚" }
            : thread
        )
      );
      addAudit("Model Center", "等待补齐模型配置", missing.join("、"), "warn");
      return true;
    }

    const capabilityDefaults = providerCapabilityDefaults[intent.provider!] ?? {};
    const payload: FiitxModelPayload = {
      id: `chat-${slug(intent.provider!)}-${slug(intent.model!)}`,
      provider: intent.provider!,
      model: intent.model!,
      baseUrl: intent.baseUrl,
      apiKey: intent.apiKey,
      contextWindow: providerContextWindowDefaults[intent.provider!] ?? 64000,
      supportsTools: capabilityDefaults.supportsTools ?? true,
      supportsVision: capabilityDefaults.supportsVision ?? false,
      supportsStreaming: capabilityDefaults.supportsStreaming ?? true,
      supportsJsonMode: capabilityDefaults.supportsJsonMode ?? true,
      bestFor: capabilityDefaults.bestFor ?? ["coding", "research"],
      toolCallStyle: capabilityDefaults.toolCallStyle ?? "openai"
    };

    let profile: FiitxModelProfile;
    try {
      const saved = await window.fiitx?.saveModelProfile(payload);
      profile = saved ?? createChatConfiguredProfile(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存模型 profile 失败";
      updateMessagesForThread(runtimeThread.id, (current) => [
        ...current,
        {
          id: `message-agent-${Date.now()}`,
          role: "agent",
          author: "Model Center",
          body: `模型配置保存失败：${message}`,
          time: timeNow()
        }
      ], true);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === runtimeThread.id
            ? { ...thread, kind: "Model Config", status: "waiting", updatedAt: "刚刚" }
            : thread
        )
      );
      addAudit("Model Center", "模型配置保存失败", message, "warn");
      return true;
    }

    upsertConfiguredProfile(profile);
    setAutoModelRouting(true);
    setModelForm((current) => ({
      ...current,
      provider: payload.provider,
      model: payload.model,
      baseUrl: payload.baseUrl ?? current.baseUrl,
      apiKey: "",
      contextWindow: payload.contextWindow ?? current.contextWindow,
      supportsTools: payload.supportsTools,
      supportsVision: payload.supportsVision,
      supportsStreaming: payload.supportsStreaming,
      supportsJsonMode: payload.supportsJsonMode,
      bestFor: payload.bestFor,
      toolCallStyle: payload.toolCallStyle
    }));
    updateMessagesForThread(runtimeThread.id, (current) => [
      ...current,
      {
        id: `message-agent-${Date.now()}`,
        role: "agent",
        author: "Model Center",
        body: `已保存模型 profile：${profile.provider} / ${profile.model}\n\nAPI Key 已脱敏并写入${encryptionAvailable ? "系统安全存储" : "本地 profile 存储"}。自动模型路由已开启，后续任务会优先使用已配置 key。`,
        time: timeNow()
      }
    ], true);
    renameThread(runtimeThread.id, `${profile.provider} 模型已配置`);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === runtimeThread.id
          ? { ...thread, kind: "Model Config", model: `${profile.provider} / ${profile.model}`, status: "done", updatedAt: "刚刚" }
          : thread
      )
    );
    addAudit("Model Center", "通过 chatbox 保存模型 profile", `${profile.provider} / ${profile.model}`, "success");
    return true;
  }

  function placeThreadInProject(threadId: string, preferredFolderId: string | null | undefined = undefined) {
    const existingFolderId = getCurrentThreadFolderId(threadId);
    const targetFolderId = preferredFolderId === undefined ? existingFolderId ?? selectedProjectFolderId : preferredFolderId;
    const folderExists = targetFolderId ? projectFoldersState.some((folder) => folder.id === targetFolderId) : false;
    const finalFolderId = folderExists ? targetFolderId : null;

    setRootThreadIds((current) => {
      const withoutThread = current.filter((item) => item !== threadId);
      return finalFolderId ? withoutThread : [threadId, ...withoutThread];
    });

    setProjectFoldersState((current) =>
      current.map((folder) => {
        const withoutThread = folder.threads.filter((item) => item !== threadId);
        return folder.id === finalFolderId
          ? {
              ...folder,
              threads: [threadId, ...withoutThread]
            }
          : {
              ...folder,
              threads: withoutThread
            };
      })
    );
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              projectFolderId: finalFolderId
            }
          : thread
      )
    );
  }

  function createTaskThread(seedPrompt = "", folderId: string | null = selectedProjectFolderId) {
    const mode = inferAgentMode(seedPrompt);
    const folder = folderId ? projectFoldersState.find((item) => item.id === folderId) : null;
    const threadWorkspacePath = folder?.path || workspacePath;
    const nextThread: Thread = {
      id: `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: buildFallbackTaskTitle(seedPrompt),
      kind: mode === "chat" ? "Chat" : "Coding",
      model: getRuntimeModelLabel(),
      status: "waiting",
      updatedAt: "刚刚",
      createdAt: Date.now(),
      workspacePath: threadWorkspacePath,
      projectFolderId: folderId
    };

    setThreads((current) => [nextThread, ...current]);
    setActiveThreadId(nextThread.id);
    setThreadRecords((current) => ({
      ...current,
      [nextThread.id]: emptyThreadRecord()
    }));
    placeThreadInProject(nextThread.id, folderId);
    return nextThread;
  }

  function renameThread(threadId: string, title: string) {
    if (!threadId || threadId === DRAFT_THREAD_ID) {
      return;
    }

    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              title: title || "未命名任务"
            }
          : thread
      )
    );
  }

  async function steerRunningTask(visibleBody: string) {
    if (!isPersistableThread(activeThreadId) || !activeAgentTaskId) {
      addAudit("Agent Session", "steer 失败", "当前没有正在运行的任务", "warn");
      return;
    }

    updateMessagesForThread(activeThreadId, (current) => [
      ...current,
      {
        id: `message-user-steer-${Date.now()}`,
        role: "user",
        author: "你",
        body: visibleBody,
        time: timeNow()
      }
    ], true);
    recordAgentProgress(activeAgentTaskId, "收到中途补充", visibleBody.slice(0, 120), "running", activeThreadId, true);
    setComposer("");
    setAttachments([]);
    addAudit("Agent Session", "steer", visibleBody.slice(0, 120), "info");

    const result = await window.fiitx?.steerAgent?.({
      threadId: activeThreadId,
      taskId: activeAgentTaskId,
      text: visibleBody
    });

    if (result && !result.ok) {
      recordAgentProgress(activeAgentTaskId, "Steer 失败", result.message || "Agent session 不可用", "warn", activeThreadId, true);
    }
  }

  function isContinueCommand(body: string, hasAttachments = false) {
    if (hasAttachments) {
      return false;
    }

    const normalized = body.trim().replace(/[。.!！?？\s]+$/g, "");
    return /^(继续|接着|继续执行|接着做|继续完成|继续上一个|继续刚才)$/.test(normalized);
  }

  function createSummaryArtifact(title: string, summary = ""): FileArtifact {
    const body = summary.trim() || "Agent 没有返回可展示内容。";
    return {
      path: `artifacts/${Date.now()}-${slug(title || "agent-result")}.md`,
      title,
      language: "markdown",
      status: "added",
      additions: body.split("\n").length,
      deletions: 0,
      preview: body
    };
  }

  async function appendAgentResultToWorkbench({
    result,
    threadId,
    taskId,
    agentMessageId,
    fallbackAuthor = "Coding Agent",
    fallbackArtifactTitle = "Agent Continue Result",
    showArtifact = true
  }: {
    result: Partial<FiitxAgentTaskResult & FiitxAgentSessionResult>;
    threadId: string;
    taskId: string;
    agentMessageId: string;
    fallbackAuthor?: string;
    fallbackArtifactTitle?: string;
    showArtifact?: boolean;
  }) {
    const summary = result.summary || result.message || result.errorMessage || "Agent 没有返回可展示内容。";
    await streamAgentFinalMessage({
      threadId,
      agentMessageId,
      author: result.agentName ?? (result.ok ? fallbackAuthor : "Agent Runtime"),
      body: summary,
      display: threadId === activeThreadId
    });

    const artifact = result.artifact as FileArtifact | null | undefined;
    const nextArtifact = artifact || (showArtifact ? createSummaryArtifact(fallbackArtifactTitle, summary) : null);
    if (nextArtifact) {
      updateArtifactsForThread(threadId, (current) => [nextArtifact, ...current], threadId === activeThreadId);
      setThreadLastArtifact(threadId, nextArtifact, threadId === activeThreadId);
      setThreadExecutionArtifacts(threadId, [nextArtifact], threadId === activeThreadId);
      if (threadId === activeThreadId) {
        selectFileArtifact(nextArtifact, { openPanel: false });
      }
    }

    appendAuditEvents(result.toolEvents ?? []);
    recordAgentProgress(
      taskId,
      result.ok ? "执行完成" : "执行异常",
      nextArtifact ? `结果已生成：${nextArtifact.title}` : summary,
      result.ok ? "success" : "warn",
      threadId,
      threadId === activeThreadId
    );
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              model: result.provider && result.model ? `${result.provider} / ${result.model}` : result.model ?? thread.model,
              kind: result.agentName ? result.agentName.replace(/\s*Agent$/i, "") : result.mode === "coding" ? "Coding" : result.mode === "chat" ? "Chat" : thread.kind,
              status: result.approvalRequests?.length ? "waiting" : result.ok ? "done" : "waiting",
              updatedAt: "刚刚"
            }
          : thread
      )
    );
  }

  async function continuePreviousTask(visibleBody: string) {
    if (!isPersistableThread(activeThreadId)) {
      return false;
    }

    const threadId = activeThreadId;
    const taskId = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const agentMessageId = `message-agent-${Date.now()}`;
    const startedAt = Date.now();

    setActiveAgentTaskId(taskId);
    setAgentRunning(true);
    setAbortPending(false);
    setExecutionArtifacts([]);
    setExecutionStartedAt(startedAt);
    setExecutionFinishedAt(null);
    setStatusNow(startedAt);
    setExecutionExpanded(false);
    updateThreadRecord(threadId, (record) => ({
      ...record,
      activeAgentTaskId: taskId,
      executionArtifacts: [],
      executionStartedAt: startedAt,
      executionFinishedAt: null,
      executionExpanded: false
    }));
    updateMessagesForThread(threadId, (current) => [
      ...current,
      {
        id: `message-user-continue-${Date.now()}`,
        role: "user",
        author: "你",
        body: visibleBody,
        time: timeNow()
      },
      {
        id: agentMessageId,
        role: "agent",
        author: "Coding Agent",
        body: "正在从当前 AgentSession 继续上一个未完成回合。",
        taskId,
        streamBaseBody: "正在从当前 AgentSession 继续上一个未完成回合。",
        streamEvents: [],
        streamStatus: "running",
        time: timeNow()
      }
    ], true);
    recordAgentProgress(taskId, "继续执行", "从当前 AgentSession 恢复。", "running", threadId, true);
    setComposer("");
    setAttachments([]);
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, status: "running", updatedAt: "刚刚" } : thread))
    );

    try {
      const result = await window.fiitx?.continueAgent?.({
        threadId,
        taskId,
        text: visibleBody
      });
      if (!result) {
        throw new Error("continueAgent 没有返回结果。");
      }
      await appendAgentResultToWorkbench({
        result,
        threadId,
        taskId,
        agentMessageId,
        fallbackArtifactTitle: "Agent Continue Result"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "继续执行失败";
      await streamAgentFinalMessage({
        threadId,
        agentMessageId,
        author: "Agent Runtime",
        body: `继续执行失败：${message}`,
        display: true
      });
      recordAgentProgress(taskId, "继续失败", message, "warn", threadId, true);
      addAudit("Agent Runtime", "继续执行失败", message, "warn");
      setThreads((current) =>
        current.map((thread) => (thread.id === threadId ? { ...thread, status: "waiting", updatedAt: "刚刚" } : thread))
      );
    } finally {
      const finishedAt = Date.now();
      setExecutionFinishedAt(finishedAt);
      setStatusNow(finishedAt);
      setExecutionExpanded(false);
      updateThreadRecord(threadId, (record) => ({
        ...record,
        executionFinishedAt: finishedAt,
        executionExpanded: false
      }));
      setAgentRunning(false);
      setAbortPending(false);
    }

    return true;
  }

  async function abortActiveTask() {
    if (!isPersistableThread(activeThreadId) || !activeAgentTaskId || abortPending) {
      return;
    }

    setAbortPending(true);
    recordAgentProgress(activeAgentTaskId, "请求停止", "用户停止当前 Agent 回合。", "warn", activeThreadId, true);
    const result = await window.fiitx?.abortAgent?.({
      threadId: activeThreadId,
      taskId: activeAgentTaskId
    });
    addAudit("Agent Session", result?.ok ? "abort" : "abort 失败", result?.message || activeThreadId, result?.ok ? "warn" : "info");
    if (!result?.ok) {
      setAbortPending(false);
    }
  }

  async function sendMessage() {
    const body = composer.trim();
    if (!body && attachments.length === 0) {
      return;
    }

    const attachmentSummary = attachments.map((path) => path.split("/").pop()).join(", ");
    const visibleBody = [body || "请处理这些附件。", attachmentSummary ? `附件：${attachmentSummary}` : ""]
      .filter(Boolean)
      .join("\n");

    if (agentRunning) {
      await steerRunningTask(visibleBody);
      return;
    }

    if (isContinueCommand(body, attachments.length > 0) && await continuePreviousTask(visibleBody)) {
      return;
    }

    if (await handleModelConfigurationMessage(body, visibleBody)) {
      return;
    }

    const permission = permissionOptions.find((option) => option.id === permissionMode) ?? permissionOptions[0];
    const optimisticMode = inferAgentMode(body || "请处理这些附件。", attachments);
    const matchedBusinessAgent = matchAgentSpecForPrompt(body || "请处理这些附件。", activeChannelAdapterId);
    const optimisticAgentLabel = matchedBusinessAgent?.name ?? agentLabel(optimisticMode);
    const runtimeThread = activeThread.id === DRAFT_THREAD_ID ? createTaskThread(body || "请处理这些附件。", selectedProjectFolderId) : activeThread;
    placeThreadInProject(runtimeThread.id);
    const agentMessageId = `message-agent-${Date.now()}`;
    const taskId = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const taskPayload: FiitxAgentTaskPayload = {
      taskId,
      prompt: body || "请处理这些附件。",
      workspacePath,
      model: getRuntimeModelId(),
      permissionMode,
      policySettings,
      attachments,
      threadId: runtimeThread.id,
      currentDate: getCurrentDateContext(),
      timeZone: "Asia/Shanghai",
      channelId: activeChannelAdapterId,
      channelContext: buildRuntimeChannelContext(runtimeThread.id),
      agentRegistry: buildRuntimeAgentRegistry(),
      channelRegistry: buildRuntimeChannelRegistry(),
      contextMessages: buildPiContextMessages(),
      threadContext: buildPiThreadContext(runtimeThread)
    };
    const optimisticBody =
      matchedBusinessAgent
        ? `正在通过 ${activeChannelAdapter?.name || "当前通道"} 调用 ${matchedBusinessAgent.name}，并结合线程上下文生成处理方案。`
        : optimisticMode === "chat"
        ? `正在通过 ${activeChannelAdapter?.name || "当前通道"} 分析上下文并自动选择模型。`
        : `正在通过 ${activeChannelAdapter?.name || "当前通道"} 分析任务意图并自动选择模型。权限为“${permission.label}”。`;
    const startedAt = Date.now();
    setActiveAgentTaskId(taskId);
    setAgentProgressEvents([]);
    setAbortPending(false);
    setLastAgentArtifact(null);
    setExecutionArtifacts([]);
    setExecutionStartedAt(startedAt);
    setExecutionFinishedAt(null);
    setStatusNow(startedAt);
    setExecutionExpanded(false);
    updateThreadRecord(runtimeThread.id, (record) => ({
      ...record,
      activeAgentTaskId: taskId,
      progressEvents: [],
      lastAgentArtifact: null,
      executionArtifacts: [],
      executionStartedAt: startedAt,
      executionFinishedAt: null,
      executionExpanded: false
    }));
    updateMessagesForThread(runtimeThread.id, (current) => [
      ...current,
      {
        id: `message-user-${Date.now()}`,
        role: "user",
        author: "你",
        body: visibleBody,
        time: timeNow()
      },
      {
        id: agentMessageId,
        role: "agent",
        author: optimisticAgentLabel,
        body: optimisticBody,
        taskId,
        streamBaseBody: optimisticBody,
        streamEvents: [],
        streamStatus: "running",
        time: timeNow()
      }
    ], true);
    recordAgentProgress(taskId, "提交任务", visibleBody.slice(0, 120), "running", runtimeThread.id, true);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === runtimeThread.id
          ? {
              ...thread,
              model: AUTO_MODEL_LABEL,
              kind: optimisticMode === "chat" ? "Chat" : "Coding",
              status: "running",
              updatedAt: "刚刚"
            }
          : thread
      )
    );
    setComposer("");
    setAttachments([]);
    setAgentRunning(true);
    addAudit(
      optimisticAgentLabel,
      optimisticMode === "chat" ? "启动 Chat 回合" : permission.auditLabel,
      optimisticMode === "chat" ? AUTO_MODEL_LABEL : runtimeThread.title,
      optimisticMode === "chat" ? "info" : permissionMode === "ask" ? "warn" : "success"
    );

    try {
      const result = await runAgentTask(taskPayload);
      if (result.title) {
        renameThread(runtimeThread.id, result.title);
      }
      await streamAgentFinalMessage({
        threadId: runtimeThread.id,
        agentMessageId,
        author: result.agentName ?? (result.ok ? agentLabel(result.mode) : "Agent Runtime"),
        body: result.summary,
        display: true
      });

      if (result.artifact) {
        const artifact = result.artifact as FileArtifact;
        updateArtifactsForThread(runtimeThread.id, (current) => [artifact, ...current], true);
        setThreadLastArtifact(runtimeThread.id, artifact, true);
        setThreadExecutionArtifacts(runtimeThread.id, [artifact], true);
        selectFileArtifact(artifact, { openPanel: false });
      }
      recordAgentProgress(
        taskId,
        result.ok ? "执行完成" : "执行异常",
        result.artifact ? `结果已生成：${result.artifact.title}` : result.summary,
        result.ok ? "success" : "warn",
        runtimeThread.id,
        true
      );

      if (result.approvalRequests?.length) {
        appendApprovalRequests(result.approvalRequests, {
          ...taskPayload,
          permissionMode: "auto",
          taskId: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
        });
      }
      appendAuditEvents(result.toolEvents ?? []);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === runtimeThread.id
            ? {
                ...thread,
                model: result.provider && result.model ? `${result.provider} / ${result.model}` : result.model ?? AUTO_MODEL_LABEL,
                kind: result.agentName ? result.agentName.replace(/\s*Agent$/i, "") : result.mode === "coding" ? "Coding" : result.mode === "chat" ? "Chat" : thread.kind,
                status: result.approvalRequests?.length ? "waiting" : result.ok ? "done" : "waiting",
                updatedAt: "刚刚"
              }
            : thread
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent runtime 执行失败";
      await streamAgentFinalMessage({
        threadId: runtimeThread.id,
        agentMessageId,
        author: "Agent Runtime",
        body: `任务失败：${message}`,
        display: true
      });
      addAudit("Agent Runtime", "任务失败", message, "warn");
      recordAgentProgress(taskId, "任务失败", message, "warn", runtimeThread.id, true);
    } finally {
      const finishedAt = Date.now();
      setExecutionFinishedAt(finishedAt);
      setStatusNow(finishedAt);
      setExecutionExpanded(false);
      updateThreadRecord(runtimeThread.id, (record) => ({
        ...record,
        executionFinishedAt: finishedAt,
        executionExpanded: false
      }));
      setAgentRunning(false);
      setAbortPending(false);
    }
  }

  async function resumeApprovedTask(approval: Approval) {
    if (!approval.resumePayload) {
      return;
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const resumeThread = threads.find((thread) => thread.id === approval.resumePayload?.threadId) ?? activeThread;
    const payload: FiitxAgentTaskPayload = {
      ...approval.resumePayload,
      taskId,
      permissionMode: "auto",
      agentRegistry: approval.resumePayload.agentRegistry ?? buildRuntimeAgentRegistry(),
      channelRegistry: approval.resumePayload.channelRegistry ?? buildRuntimeChannelRegistry(),
      channelId: approval.resumePayload.channelId ?? activeChannelAdapterId,
      channelContext: approval.resumePayload.channelContext ?? buildRuntimeChannelContext(approval.resumePayload.threadId),
      threadContext: buildPiThreadContext(resumeThread)
    };
    const agentMessageId = `message-agent-${Date.now()}`;
    const startedAt = Date.now();
    setActiveAgentTaskId(taskId);
    setAgentRunning(true);
    setAbortPending(false);
    setExecutionArtifacts([]);
    setExecutionStartedAt(startedAt);
    setExecutionFinishedAt(null);
    setStatusNow(startedAt);
    setExecutionExpanded(false);
    updateThreadRecord(payload.threadId, (record) => ({
      ...record,
      activeAgentTaskId: taskId,
      executionArtifacts: [],
      executionStartedAt: startedAt,
      executionFinishedAt: null,
      executionExpanded: false
    }));
    updateMessagesForThread(payload.threadId, (current) => [
      ...current,
      {
        id: agentMessageId,
        role: "agent",
        author: "Coding Agent",
        body: "已收到审批，继续执行任务。",
        taskId,
        streamBaseBody: "已收到审批，继续执行任务。",
        streamEvents: [],
        streamStatus: "running",
        time: timeNow()
      }
    ], payload.threadId === activeThreadId);
    recordAgentProgress(taskId, "恢复执行", approval.command, "running", payload.threadId, payload.threadId === activeThreadId);

    try {
      const result = await runAgentTask(payload);
      if (result.title) {
        renameThread(payload.threadId, result.title);
      }
      await streamAgentFinalMessage({
        threadId: payload.threadId,
        agentMessageId,
        author: result.agentName ?? (result.ok ? agentLabel(result.mode) : "Agent Runtime"),
        body: result.summary,
        display: payload.threadId === activeThreadId
      });
      if (result.artifact) {
        const artifact = result.artifact as FileArtifact;
        updateArtifactsForThread(payload.threadId, (current) => [artifact, ...current], payload.threadId === activeThreadId);
        setThreadLastArtifact(payload.threadId, artifact, payload.threadId === activeThreadId);
        setThreadExecutionArtifacts(payload.threadId, [artifact], payload.threadId === activeThreadId);
        if (payload.threadId === activeThreadId) {
          selectFileArtifact(artifact, { openPanel: false });
        }
      }
      appendAuditEvents(result.toolEvents ?? []);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === payload.threadId
            ? {
                ...thread,
                model: result.model ?? payload.model,
                status: result.ok ? "done" : "waiting",
                updatedAt: "刚刚"
              }
            : thread
        )
      );
      recordAgentProgress(taskId, result.ok ? "执行完成" : "执行异常", result.summary, result.ok ? "success" : "warn", payload.threadId, payload.threadId === activeThreadId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "审批后恢复执行失败";
      await streamAgentFinalMessage({
        threadId: payload.threadId,
        agentMessageId,
        author: "Agent Runtime",
        body: `审批后恢复执行失败：${message}`,
        display: payload.threadId === activeThreadId
      });
      recordAgentProgress(taskId, "恢复失败", message, "warn", payload.threadId, payload.threadId === activeThreadId);
      addAudit("Agent Runtime", "审批后恢复失败", message, "warn");
    } finally {
      const finishedAt = Date.now();
      setExecutionFinishedAt(finishedAt);
      setStatusNow(finishedAt);
      setExecutionExpanded(false);
      updateThreadRecord(payload.threadId, (record) => ({
        ...record,
        executionFinishedAt: finishedAt,
        executionExpanded: false
      }));
      setAgentRunning(false);
      setAbortPending(false);
    }
  }

  async function resolveApproval(id: string, status: Exclude<ApprovalStatus, "pending">) {
    const approval = approvals.find((item) => item.id === id);
    if (!approval) {
      return;
    }

    setApprovals((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    const targetThreadId = approval.resumePayload?.threadId || activeThreadId;
    updateMessagesForThread(targetThreadId, (current) => [
      ...current,
      {
        id: `message-approval-${Date.now()}`,
        role: "system",
        author: "Policy Engine",
        body:
          status === "approved"
            ? `已批准：${approval.command}`
            : `已拒绝：${approval.command}`,
        time: timeNow()
      }
    ], targetThreadId === activeThreadId);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === approval.resumePayload?.threadId
          ? { ...thread, status: status === "approved" ? "running" : "done", updatedAt: "刚刚" }
          : thread
      )
    );
    addAudit("Policy Engine", status === "approved" ? "批准工具调用" : "拒绝工具调用", approval.command, status === "approved" ? "success" : "warn");
    if (status === "approved") {
      await resumeApprovedTask(approval);
    }
  }

  function selectProvider(name: string) {
    const provider = providerTemplates.find((item) => item.name === name);
    const capabilityDefaults = providerCapabilityDefaults[name] ?? {};
    setModelForm((current) => ({
      ...current,
      ...capabilityDefaults,
      provider: name,
      model: providerModelDefaults[name] ?? current.model,
      baseUrl: provider?.baseUrl ?? current.baseUrl
    }));
    setTestState("idle");
    setTestMessage("等待连接测试");
  }

  function toggleBestFor(item: string) {
    setModelForm((current) => ({
      ...current,
      bestFor: current.bestFor.includes(item)
        ? current.bestFor.filter((value) => value !== item)
        : current.bestFor.concat(item)
    }));
  }

  function setPolicyActionMode(action: string, mode: ToolPolicyMode) {
    setPolicySettings((current) => ({
      ...current,
      actionModes: {
        ...current.actionModes,
        [action]: mode
      }
    }));
  }

  function setDefaultPolicyMode(mode: PermissionMode) {
    setPolicySettings((current) => ({
      ...current,
      defaultPermissionMode: mode
    }));
    setPermissionMode(mode);
  }

  async function testModelConnection() {
    setTestState("testing");
    setTestMessage("正在校验 provider、模型和凭据格式");
    const payload = {
      ...modelForm,
      contextWindow: Number(modelForm.contextWindow)
    };
    const result = await window.fiitx?.testModelConnection(payload);

    if (result?.ok || (!window.fiitx && modelForm.provider && modelForm.model && modelForm.apiKey)) {
      setTestState("passed");
      setTestMessage(result?.message ?? "本地预览环境校验通过");
      addAudit("Model Center", "模型连接测试通过", `${modelForm.provider} / ${modelForm.model}`, "success");
    } else {
      setTestState("failed");
      setTestMessage(result?.message ?? "供应商、模型和 API Key 不能为空");
      addAudit("Model Center", "模型连接测试失败", `${modelForm.provider} / ${modelForm.model}`, "warn");
    }
  }

  async function saveModelProfile() {
    setSavingProfile(true);
    const payload = {
      ...modelForm,
      contextWindow: Number(modelForm.contextWindow)
    };

    try {
      const saved = await window.fiitx?.saveModelProfile(payload);
      const profile =
        saved ??
        ({
          id: `local-${Date.now()}`,
          provider: payload.provider,
          model: payload.model,
          baseUrl: payload.baseUrl,
          apiKeyRef: `keychain:${payload.provider}:${payload.model}`,
          contextWindow: payload.contextWindow,
          supportsTools: payload.supportsTools,
          supportsVision: payload.supportsVision,
          supportsStreaming: payload.supportsStreaming,
          supportsJsonMode: payload.supportsJsonMode,
          bestFor: payload.bestFor,
          toolCallStyle: payload.toolCallStyle,
          updatedAt: new Date().toISOString()
      } satisfies FiitxModelProfile);

      upsertConfiguredProfile(profile);
      setModelForm((current) => ({ ...current, apiKey: "" }));
      addAudit("Model Center", "保存模型 profile", `${profile.provider} / ${profile.model}`, "success");
    } finally {
      setSavingProfile(false);
    }
  }

  function renderHeader() {
    const workspaceLabel = workspacePath ? workspacePath.split("/").filter(Boolean).slice(-1)[0] : t("workspace.choose");
    const activeSettingsItem = settingsNavItems.find((item) => item.id === activeSettingsPage);
    const headerTitle = activeView === "workbench" ? activeThread.title : activeSettingsItem ? settingsLabel(activeSettingsItem.id) : t("settings.fallbackTitle");
    return (
      <header className="topbar">
        <div className="topbar-title-group">
          {activeView !== "settings" && !visiblePanels.sidebar ? renderPaneToggleButton("sidebar", "topbar-pane-toggle") : null}
          <div className="topbar-title-copy">
          <div className="eyebrow">{PRODUCT_EYEBROW}</div>
          <h1 title={headerTitle}>{headerTitle}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-text-button ghost" onClick={chooseWorkspace} title={t("workspace.choose")}>
            <FolderOpen size={17} />
            <span>{workspaceLabel}</span>
          </button>
          <button className="icon-button ghost" title={t("action.refresh")}>
            <RefreshCw size={18} />
          </button>
          {activeView === "workbench" ? renderPaneToggleButton("artifact", "topbar-pane-toggle") : null}
        </div>
      </header>
    );
  }

  function renderSelectedFileHeaderActions() {
    if (!selectedFile) {
      return null;
    }

    const targetTab = artifactTabs.find((tab) => tab.id === getArtifactIdForFile(selectedFile)) ?? artifactTabs[2];
    const TargetIcon = targetTab.icon;
    return (
      <>
        <button className="icon-text-button file-header-action active" onClick={() => setActiveArtifact(targetTab.id)} type="button">
          <TargetIcon size={15} />
          <span>{targetTab.label}</span>
        </button>
        <button className="icon-text-button file-header-action" onClick={() => setSelectedFile(null)} type="button">
          <X size={15} />
          <span>关闭</span>
        </button>
      </>
    );
  }

  function renderProjectSection() {
    return (
      <div className="sidebar-section project-section">
        <div className="sidebar-section-heading">
          <button
            className={selectedProjectFolderId ? "section-label project-root-button" : "section-label project-root-button active"}
            onClick={() => setSelectedProjectFolderId(null)}
            title={t("sidebar.projects")}
            type="button"
          >
            {t("sidebar.projects")}
          </button>
          <div className="project-menu-wrap">
            <button className="section-icon-button" onClick={() => setProjectMenuOpen((open) => !open)} title="添加项目文件夹">
              <FolderPlus size={16} />
            </button>
            {projectMenuOpen ? (
              <div className="project-menu-popover">
                <button onClick={createBlankProject}>
                  <SquarePlus size={16} />
                  <span>新建空白项目</span>
                </button>
                <button onClick={addExistingFolderProject}>
                  <Folder size={16} />
                  <span>使用现有文件夹</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="project-tree">
          {rootThreadIds.length === 0 && projectFoldersState.length === 0 ? <div className="empty-inline">暂无任务</div> : null}
          {rootThreadIds.length > 0 ? (
            <div className="project-thread-list root-thread-list">
              {rootThreadIds.map((threadId) => {
                const thread = threads.find((item) => item.id === threadId);
                if (!thread) {
                  return null;
                }

                return (
                  <button
                    className={thread.id === activeThread.id ? "project-thread-row active" : "project-thread-row"}
                    key={`root-${thread.id}`}
                    onClick={() => openTaskThread(thread.id, null)}
                  >
                    <span className={`status-dot ${thread.status}`} />
                    <span>
                      <strong>{thread.title}</strong>
                      <small>{thread.kind}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {projectFoldersState.map((folder) => {
            const isCollapsed = Boolean(collapsedProjectFolders[folder.id]);
            const isSelected = selectedProjectFolderId === folder.id;
            return (
              <div className="project-folder" key={folder.id}>
                <button
                  className={[
                    "project-folder-title",
                    isCollapsed ? "collapsed" : "",
                    isSelected ? "selected" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleProjectFolder(folder.id)}
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? "展开文件夹" : "关闭文件夹"}
                >
                  {isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />}
                  <span>{folder.name}</span>
                  <ChevronDown className="folder-caret" size={15} />
                </button>
                {!isCollapsed ? (
                  <div className="project-thread-list">
                    {folder.threads.map((threadId) => {
                      const thread = threads.find((item) => item.id === threadId);
                      if (!thread) {
                        return null;
                      }

                      return (
                        <button
                          className={thread.id === activeThread.id ? "project-thread-row active" : "project-thread-row"}
                          key={`${folder.id}-${thread.id}`}
                          onClick={() => openTaskThread(thread.id, folder.id)}
                        >
                          <span className={`status-dot ${thread.status}`} />
                          <span>
                            <strong>{thread.title}</strong>
                            <small>{thread.kind}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPaneToggleButton(panel: Exclude<PanelKey, "terminal">, className = "") {
    const Icon = panel === "sidebar" ? PanelLeft : PanelRight;
    const isVisible = visiblePanels[panel];
    const title =
      panel === "sidebar"
        ? isVisible ? t("pane.sidebar.collapse") : t("pane.sidebar.expand")
        : isVisible ? t("pane.right.collapse") : t("pane.right.expand");

    return (
      <button
        className={["pane-toggle-button", className].filter(Boolean).join(" ")}
        title={title}
        onClick={() => togglePanel(panel)}
        type="button"
      >
        <Icon size={18} />
      </button>
    );
  }

  function renderSidebar() {
    return (
      <aside className="sidebar">
        <div className="window-drag" />
        <div className="brand">
          <img src={logoUrl} alt={PRODUCT_NAME} />
          <div className="brand-copy">
            <span>{t("product.subtitle")}</span>
          </div>
          {renderPaneToggleButton("sidebar", "sidebar-brand-toggle")}
        </div>

        <div className="sidebar-action-list">
          <button className="sidebar-action-button" onClick={createThread} type="button">
            <SquarePen size={18} />
            <span>{t("sidebar.newTask")}</span>
          </button>
        </div>

        {renderProjectSection()}

        <footer className="sidebar-footer">
          <button
            className={activeView === "settings" ? "sidebar-settings-button active" : "sidebar-settings-button"}
            onClick={() => setActiveView("settings")}
            type="button"
            title={t("sidebar.settings")}
          >
            <Settings size={17} />
            <span>{t("sidebar.settings")}</span>
          </button>
        </footer>
      </aside>
    );
  }

  function renderWorkbench() {
    return (
      <div
        className={[
          "workbench-grid",
          visiblePanels.artifact ? "" : "artifact-hidden",
          artifactMaximized && visiblePanels.artifact ? "artifact-maximized" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <section className="conversation panel">
          <div className="task-scroll-area" ref={taskScrollRef}>
            <div className="task-header">
              <div>
                <input
                  className="task-title-input"
                  value={activeThread.title}
                  onChange={(event) => renameThread(activeThread.id, event.target.value)}
                  placeholder="未命名任务"
                  disabled={activeThread.id === DRAFT_THREAD_ID}
                />
                <p>{activeThread.kind} · {activeThread.model}</p>
              </div>
              {activeThread.id !== DRAFT_THREAD_ID ? <div className={`task-status ${activeThread.status}`}>{threadStatusLabel(activeThread.status)}</div> : null}
            </div>

            {artifacts.length > 0 ? (
              <div className="changed-files-card">
                <div className="changed-files-header">
                  <div>
                    <strong>Artifact {artifacts.length} 个文件</strong>
                    <span>+{artifacts.reduce((sum, file) => sum + file.additions, 0)} -{artifacts.reduce((sum, file) => sum + file.deletions, 0)}</span>
                  </div>
                  <button className="icon-text-button" title="审核文件变更">
                    <ClipboardCheck size={16} />
                    <span>审核</span>
                  </button>
                </div>
                <div className="changed-files-list">
                  {artifacts.map((file) => (
                    <button
                      key={file.path}
                      className={selectedFile?.path === file.path ? "changed-file-row active" : "changed-file-row"}
                      onClick={() => selectFileArtifact(file)}
                    >
                      <span>{file.title}</span>
                      <code>
                        +{file.additions} -{file.deletions}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <MessageList
              messages={messages}
              renderMessageBody={renderMessageBody}
              renderExecutionActivity={renderExecutionActivity}
              onCopyMessage={(message) => copyText(message.role === "user" ? message.body : stripAgentStreamSection(message.body))}
            />
            <div className="message-end-anchor" ref={messageEndRef} />
          </div>

          <div className="composer">
            {attachments.length > 0 ? (
              <div className="attachment-row">
                {attachments.map((path) => (
                  <button className="attachment-chip" key={path} onClick={() => selectAttachmentArtifact(path)} title="查看附件内容">
                    <FileText size={14} />
                    <span>{path.split("/").pop()}</span>
                    <X
                      size={13}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeAttachment(path);
                      }}
                    />
                  </button>
                ))}
              </div>
            ) : null}
            {activeChannelAdapter ? (
              <div className="composer-channel-row">
                <div className="composer-channel-chip" title={activeChannelAdapter.description}>
                  <MessageSquare size={14} />
                  <span>{t("composer.currentChannel", { name: activeChannelAdapter.name })}</span>
                </div>
              </div>
            ) : null}
            <div className="composer-input">
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onPaste={handleComposerPaste}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={t("composer.placeholder")}
              />
            </div>
            <div className="composer-actions">
              <div className="composer-actions-left">
                <button className="composer-icon-button" onClick={addAttachments} title={t("action.addAttachment")}>
                  <Plus size={21} />
                </button>
                <label className={`composer-select permission-control ${permissionMode}`}>
                  <Shield size={16} />
                  <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as PermissionMode)}>
                    {permissionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {permissionLabel(option.id)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </label>
              </div>
              <div className="composer-actions-right">
                <button className="composer-icon-button" onClick={startVoiceInput} title={t("action.voiceInput")}>
                  <Mic size={19} />
                </button>
                {agentRunning ? (
                  <button
                    className="composer-icon-button stop-task-button"
                    onClick={abortActiveTask}
                    title={abortPending ? t("action.stopping") : t("action.stopTask")}
                    disabled={abortPending}
                    type="button"
                  >
                    <Square size={15} fill="currentColor" />
                  </button>
                ) : null}
                <button
                  className={agentRunning ? "send-button steering" : "send-button"}
                  onClick={sendMessage}
                  title={agentRunning ? t("action.sendSteer") : t("action.sendTask")}
                  disabled={!composer.trim() && attachments.length === 0}
                  type="button"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {visiblePanels.artifact ? (
          rightPaneMode === "code" ? (
            <section className="ide-pane panel">
              <WorkspaceIDE
                workspacePath={activeThread.workspacePath || workspacePath}
                artifacts={artifacts}
                selectedArtifact={null}
                selectedWorkspaceFile={selectedWorkspaceFile}
                isMaximized={artifactMaximized}
                onToggleMaximize={() => setArtifactMaximized((current) => !current)}
                onChooseWorkspace={chooseWorkspace}
                onSaved={(path, bytes) => addAudit("Workspace IDE", "保存文件", `${path} · ${bytes} bytes`, "success")}
              />
            </section>
          ) : (
            <section className="artifact-pane panel">
              <header className="artifact-pane-header">
                <div>
                  <span>Artifact Preview</span>
                  <strong>{selectedFile?.title || "预览"}</strong>
                </div>
                <div className="artifact-pane-actions">
                  {renderSelectedFileHeaderActions()}
                  <button
                    className="icon-text-button file-header-action"
                    onClick={() => selectedFile ? void openLocalPathInIde(selectedFile.path) : setRightPaneMode("code")}
                    type="button"
                  >
                    <Code2 size={15} />
                    <span>代码</span>
                  </button>
                  <button className="icon-text-button file-header-action" onClick={() => setArtifactMaximized((current) => !current)} type="button">
                    {artifactMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    <span>{artifactMaximized ? "还原" : "最大化"}</span>
                  </button>
                </div>
              </header>
              {renderArtifact()}
            </section>
          )
        ) : null}

        {resourceContextMenu ? (
          <div
            className="resource-context-menu"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
            style={{ left: resourceContextMenu.x, top: resourceContextMenu.y }}
          >
            <button
              type="button"
              onClick={() => {
                void previewResourcePath(resourceContextMenu.path);
                setResourceContextMenu(null);
              }}
            >
              <Eye size={14} />
              <span>预览</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void openLocalPathInIde(resourceContextMenu.path);
                setResourceContextMenu(null);
              }}
            >
              <Code2 size={14} />
              <span>代码</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void openContainingFolder(resourceContextMenu.path);
                setResourceContextMenu(null);
              }}
            >
              <FolderOpen size={14} />
              <span>打开所在位置</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderArtifact() {
    if (selectedFile) {
      const header = [
        `### ${selectedFile.title}`,
        `- 路径：${selectedFile.path}`,
        `- 状态：${selectedFile.status}，+${selectedFile.additions} -${selectedFile.deletions}`
      ].join("\n");
      const artifactMarkdown = `${header}\n\n${selectedFile.preview}`;

      if (activeArtifact === "image") {
        const extension = getArtifactExtension(selectedFile);
        const mediaKind = getMediaKindFromExtension(extension);
        const source = selectedFile.path || selectedFile.preview;
        const htmlContent = mediaKind === "html" ? selectedFile.preview : "";
        const mediaPreview = renderMediaPreview(source, selectedFile.title, `selected-media-${selectedFile.path}`, htmlContent);

        if (mediaPreview) {
          return (
            <div className="artifact-preview selected-media-preview">
              {mediaPreview}
            </div>
          );
        }

        return (
          <div className="artifact-preview cover-art selected-image-preview">
            <img src={getFileUrl(selectedFile.path)} alt={selectedFile.title} />
            <div>
              <strong>{selectedFile.title}</strong>
              <span>{selectedFile.path}</span>
            </div>
          </div>
        );
      }

      if (activeArtifact === "ppt") {
        return (
          <div className="artifact-preview document selected-file-document markdown-message artifact-markdown">
            <button className="markdown-copy-button" onClick={() => copyText(artifactMarkdown)} title="复制 Markdown">
              <Copy size={14} />
              <span>复制</span>
            </button>
            {renderMarkdownBlocks(artifactMarkdown)}
          </div>
        );
      }

      if (activeArtifact === "report") {
        return (
          <div className="artifact-preview document selected-file-document markdown-message artifact-markdown">
            <button className="markdown-copy-button" onClick={() => copyText(artifactMarkdown)} title="复制 Markdown">
              <Copy size={14} />
              <span>复制</span>
            </button>
            {renderMarkdownBlocks(artifactMarkdown)}
          </div>
        );
      }

      return (
        <div className="artifact-preview diff selected-file-preview artifact-code-preview">
          {renderCodeBlock(selectedFile.preview, selectedFile.language || getArtifactExtension(selectedFile), `artifact-${selectedFile.path}`)}
        </div>
      );
    }

    return (
      <div className="artifact-preview empty-artifact">
        <FileText size={22} />
        <span>暂无 Artifact</span>
      </div>
    );
  }

  function renderModels() {
    return (
      <div className="model-layout">
        <section className="panel provider-panel">
          <div className="panel-header">
            <div>
              <span>供应商</span>
              <small>一等 provider 配置</small>
            </div>
          </div>
          <div className="provider-list">
            {providerTemplates.map((provider) => (
              <button
                key={provider.name}
                className={modelForm.provider === provider.name ? "provider-row active" : "provider-row"}
                onClick={() => selectProvider(provider.name)}
              >
                <span>{provider.name}</span>
                <small>{provider.tag}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel config-panel">
          <div className="panel-header">
            <div>
              <span>模型 Profile</span>
              <small>保存为可路由模型</small>
            </div>
            <div className={`test-chip ${testState}`}>{testMessage}</div>
          </div>

          <div className="form-grid">
            <label>
              <span>Provider</span>
              <input value={modelForm.provider} onChange={(event) => setModelForm((current) => ({ ...current, provider: event.target.value }))} />
            </label>
            <label>
              <span>Model</span>
              <input value={modelForm.model} onChange={(event) => setModelForm((current) => ({ ...current, model: event.target.value }))} />
            </label>
            <label className="wide">
              <span>Base URL</span>
              <input value={modelForm.baseUrl} onChange={(event) => setModelForm((current) => ({ ...current, baseUrl: event.target.value }))} />
            </label>
            <label className="wide">
              <span>API Key</span>
              <input
                type="password"
                value={modelForm.apiKey}
                onChange={(event) => setModelForm((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder="保存时写入系统安全存储"
              />
            </label>
            <label>
              <span>Context Window</span>
              <input
                type="number"
                value={modelForm.contextWindow}
                onChange={(event) => setModelForm((current) => ({ ...current, contextWindow: Number(event.target.value) }))}
              />
            </label>
            <label>
              <span>Tool Call Style</span>
              <select value={modelForm.toolCallStyle} onChange={(event) => setModelForm((current) => ({ ...current, toolCallStyle: event.target.value }))}>
                <option value="openai">openai</option>
                <option value="anthropic">anthropic</option>
                <option value="gemini">gemini</option>
                <option value="none">none</option>
              </select>
            </label>
          </div>

          <div className="capability-row">
            {[
              ["supportsTools", "Tools"],
              ["supportsVision", "Vision"],
              ["supportsStreaming", "Streaming"],
              ["supportsJsonMode", "JSON Mode"]
            ].map(([key, label]) => (
              <button
                key={key}
                className={modelForm[key as keyof ModelForm] ? "toggle active" : "toggle"}
                onClick={() =>
                  setModelForm((current) => ({
                    ...current,
                    [key]: !current[key as keyof ModelForm]
                  }))
                }
              >
                <Check size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="chips">
            {bestForOptions.map((item) => (
              <button key={item} className={modelForm.bestFor.includes(item) ? "chip active" : "chip"} onClick={() => toggleBestFor(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="form-actions">
            <button className="icon-text-button" onClick={testModelConnection}>
              <Play size={16} />
              <span>{testState === "testing" ? "测试中" : "测试连接"}</span>
            </button>
            <button className="primary-button" onClick={saveModelProfile} disabled={savingProfile}>
              <Save size={16} />
              <span>{savingProfile ? "保存中" : "保存 Profile"}</span>
            </button>
          </div>
        </section>

        <section className="panel profiles-panel">
          <div className="panel-header">
            <div>
              <span>已配置模型</span>
              <small>{profiles.filter(hasProfileKey).length} 个已配置 Key</small>
            </div>
            <label className="model-routing-switch">
              <span>{AUTO_MODEL_LABEL}</span>
              <input
                type="checkbox"
                checked={autoModelRouting}
                onChange={(event) => setAutoModelRouting(event.target.checked)}
              />
              <b aria-hidden="true" />
            </label>
          </div>
          <div className="profile-list">
            {profiles.map((profile) => (
              <div className={hasProfileKey(profile) ? "profile-row" : "profile-row missing-key"} key={profile.id}>
                <div className="profile-icon">
                  <KeyRound size={18} />
                </div>
                <div>
                  <strong>{profile.model}</strong>
                  <span>{profile.provider} · {profileSummary(profile)}</span>
                  <small>{profileKeyLabel(profile)}</small>
                  <small className="profile-route-meta">{profileRouteLabel(profile)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function parseAgentListInput(value: string) {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function updateAgentSpec(id: string, patch: Partial<AgentSpec>) {
    setAgentSpecs((current) => current.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)));
  }

  function updateAgentListField(id: string, key: "tools" | "skills" | "triggers" | "systems" | "metrics" | "channels", value: string) {
    updateAgentSpec(id, { [key]: parseAgentListInput(value) } as Partial<AgentSpec>);
  }

  function updateAgentStage(agentId: string, index: number, patch: Partial<AgentStage>) {
    setAgentSpecs((current) =>
      current.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              stages: agent.stages.map((stage, stageIndex) => (stageIndex === index ? { ...stage, ...patch } : stage))
            }
          : agent
      )
    );
  }

  function addAgentStage(agentId: string) {
    setAgentSpecs((current) =>
      current.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              stages: agent.stages.concat({
                name: "新阶段",
                owner: agent.name,
                trigger: "待定义触发条件",
                action: "待定义动作",
                output: "待定义输出"
              })
            }
          : agent
      )
    );
  }

  function removeAgentStage(agentId: string, index: number) {
    setAgentSpecs((current) =>
      current.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              stages: agent.stages.filter((_, stageIndex) => stageIndex !== index)
            }
          : agent
      )
    );
  }

  function resetAgentSpecs() {
    setAgentSpecs(defaultAgentSpecs);
    setSelectedAgentId(defaultAgentSpecs[0]?.id ?? "");
    addAudit("Agent Registry", "重置行业 Agent 模板", "hotel-travel-defaults", "warn");
  }

  function updateChannelAdapterSpec(id: string, patch: Partial<ChannelAdapterSpec>) {
    setChannelAdapters((current) =>
      current.map((adapter) => (adapter.id === id ? { ...adapter, ...patch } : adapter))
    );
  }

  function updateChannelAdapterListField(
    id: string,
    key: "capabilities" | "contextSources" | "outputModes" | "agentBindings",
    value: string
  ) {
    updateChannelAdapterSpec(id, {
      [key]: value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    } as Partial<ChannelAdapterSpec>);
  }

  function resetChannelAdapters() {
    setChannelAdapters(defaultChannelAdapters);
    setSelectedChannelAdapterId(defaultChannelAdapters[0]?.id ?? "");
    setActiveChannelAdapterId(defaultChannelAdapters[0]?.id ?? "");
    addAudit("Channel Registry", "重置通道模板", "channel-adapters-defaults", "warn");
  }

  function activateChannelAdapter(adapterId: string) {
    setActiveChannelAdapterId(adapterId);
    setActiveView("workbench");
    const adapter = channelAdapters.find((item) => item.id === adapterId);
    addAudit("Channel Adapter", "切换当前通道", adapter?.name || adapterId, "info");
  }

  function buildAgentManifest(agent: AgentSpec) {
    return `# ${agent.name}

## AGENTS.md instruction
${agent.systemPrompt}

## Objective
${agent.objective}

## Skills
${agent.skills.map((skill) => `- ${skill}`).join("\n")}

## Tool schema draft
\`\`\`json
${JSON.stringify(
  {
    name: agent.id,
    description: agent.scope,
    policy: agent.policy,
    channels: agent.channels,
    systems: agent.systems,
    tools: agent.tools.map((tool) => ({
      name: tool,
      description: `${agent.name} can call ${tool}`,
      inputSchema: {
        type: "object",
        properties: {
          context: { type: "string", description: "业务上下文，来自 Fiitx threadContext / 外部系统事件 / 用户输入" }
        },
        required: ["context"]
      }
    }))
  },
  null,
  2
)}
\`\`\`

## Orchestration
${agent.stages.map((stage, index) => `${index + 1}. ${stage.name}: ${stage.trigger} -> ${stage.action} -> ${stage.output}`).join("\n")}
`;
  }

  function buildChannelManifest(adapter: ChannelAdapterSpec) {
    return `# ${adapter.name}

## Channel adapter
- id: ${adapter.id}
- type: ${adapter.channelType}
- transport: ${adapter.transport}
- entrypoint: ${adapter.entrypoint}
- sessionKey: ${adapter.sessionKeyStrategy}
- followUp: ${adapter.followUpPolicy}

## Capabilities
${adapter.capabilities.map((item) => `- ${item}`).join("\n")}

## Context sources
${adapter.contextSources.map((item) => `- ${item}`).join("\n")}

## Output modes
${adapter.outputModes.map((item) => `- ${item}`).join("\n")}

## Bound business agents
${adapter.agentBindings.map((item) => `- ${item}`).join("\n")}

## System prompt
${adapter.systemPrompt}

## Sample event
\`\`\`json
${adapter.sampleEvent}
\`\`\`
`;
  }

  function useAgentInWorkbench(agent: AgentSpec) {
    setActiveView("workbench");
    setComposer(`使用「${agent.name}」处理任务：\n\n目标：${agent.objective}\n\n请先基于当前上下文制定执行计划，再按 policy gate 请求必要审批。`);
  }

  function renderAgentListEditor(agent: AgentSpec, key: "tools" | "skills" | "triggers" | "systems" | "metrics" | "channels", label: string) {
    return (
      <label className="agent-editor-field">
        <span>{label}</span>
        <textarea
          value={agent[key].join("\n")}
          onChange={(event) => updateAgentListField(agent.id, key, event.target.value)}
          rows={Math.min(6, Math.max(3, agent[key].length))}
        />
      </label>
    );
  }

  function renderChannelListEditor(
    adapter: ChannelAdapterSpec,
    key: "capabilities" | "contextSources" | "outputModes" | "agentBindings",
    label: string
  ) {
    return (
      <label className="agent-editor-field">
        <span>{label}</span>
        <textarea
          value={adapter[key].join("\n")}
          onChange={(event) => updateChannelAdapterListField(adapter.id, key, event.target.value)}
          rows={Math.min(6, Math.max(3, adapter[key].length))}
        />
      </label>
    );
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function pickString(value: unknown, keys: string[], fallback = "未匹配") {
    if (!isRecord(value)) {
      return fallback;
    }
    for (const key of keys) {
      const item = value[key];
      if (typeof item === "string" && item.trim()) {
        return item;
      }
    }
    return fallback;
  }

  function modelRouteLabel(value: unknown) {
    if (!isRecord(value)) {
      return "未匹配模型";
    }
    const provider = pickString(value, ["provider"], "");
    const model = pickString(value, ["model", "id"], "");
    return [provider, model].filter(Boolean).join(" / ") || "未匹配模型";
  }

  function channelRouteLabel(value: unknown) {
    if (!isRecord(value)) {
      return "未匹配通道";
    }
    const name = pickString(value, ["name", "id"], "");
    const type = pickString(value, ["channelType", "transport"], "");
    return [name, type].filter(Boolean).join(" · ") || "未匹配通道";
  }

  function boolRouteText(value: unknown) {
    return value ? "是" : "否";
  }

  function agentStatusText(status: AgentSpec["status"]) {
    if (status === "active") {
      return "已启用";
    }
    if (status === "ready") {
      return "可启用";
    }
    return "草稿";
  }

  function testPromptForAgent(agent: AgentSpec) {
    if (agent.id === "complaint-recovery") {
      return "客人投诉房间有异味，帮我分级并生成补救方案。";
    }
    if (agent.id === "concierge-trip") {
      return "帮住客规划北京海淀两天一晚亲子行程。";
    }
    if (agent.id === "revenue-manager") {
      return "本周末入住率偏低，帮我分析是否需要调价。";
    }
    if (agent.id === "marketing-content") {
      return "帮我为亲子房套餐生成一组小红书营销素材。";
    }
    if (agent.id === "guest-service") {
      return "住客想续住并询问能否换到安静房间。";
    }
    if (agent.id === "ops-quality") {
      return "今天客房巡检发现三间房清洁超时，帮我生成整改任务。";
    }
    return agent.triggers[0] || "客人投诉房间异味，帮我分级并生成补救方案。";
  }

  function editAgent(agent: AgentSpec) {
    setSelectedAgentId(agent.id);
    setAgentAdminOpen(true);
  }

  function testAgentRoute(agent: AgentSpec) {
    const prompt = testPromptForAgent(agent);
    setSelectedAgentId(agent.id);
    setRouteLabPrompt(prompt);
    setAgentDebugOpen(true);
    void runRouteLab(prompt);
  }

  function renderAgents() {
    if (!selectedAgent || !selectedChannelAdapter) {
      return <div className="panel empty-state">暂无 Agent 编排</div>;
    }

    const manifest = buildAgentManifest(selectedAgent);
    const channelManifest = buildChannelManifest(selectedChannelAdapter);
    const activeCount = agentSpecs.filter((agent) => agent.status === "active").length;
    const activeChannelCount = channelAdapters.filter((adapter) => adapter.status === "active").length;
    const readyCount = agentSpecs.filter((agent) => agent.status !== "draft").length;
    const routeContextPlan = isRecord(routeLabResult?.contextPlan) ? routeLabResult.contextPlan : {};
    const routePolicyPlan = Array.isArray(routeLabResult?.policyPlan) ? routeLabResult.policyPlan : [];
    const routeModelCandidates = Array.isArray(routeLabResult?.modelCandidates) ? routeLabResult.modelCandidates : [];
    const failedEvalCases = evalResult?.results.filter((item) => !item.ok) ?? [];

    return (
      <div className="agent-management-console">
        <section className="agent-hero agent-management-hero panel">
          <div>
            <span className="eyebrow">Agent Management</span>
            <h2>行业 Agent 能力中心</h2>
            <p>为不同业务团队配置可直接上岗的 Agent。默认只展示能解决什么问题、适合什么场景和是否启用；高级路由、工具、评测和调试信息收进下方高级区。</p>
          </div>
          <div className="agent-overview-grid">
            <div>
              <strong>{agentSpecs.length}</strong>
              <span>业务 Agent</span>
            </div>
            <div>
              <strong>{readyCount}</strong>
              <span>可用模板</span>
            </div>
            <div>
              <strong>{activeChannelCount}</strong>
              <span>接入通道</span>
            </div>
            <div>
              <strong>{activeCount}</strong>
              <span>已启用</span>
            </div>
          </div>
        </section>

        <section className="agent-catalog panel">
          <div className="panel-header">
            <div>
              <span>可用 Agent</span>
              <small>业务用户只需要选择能力、测试效果，管理员再进入配置。</small>
            </div>
          </div>
          <div className="agent-card-grid">
            {agentSpecs.map((agent) => (
              <article className={selectedAgent.id === agent.id ? `business-agent-card selected ${agent.accent}` : `business-agent-card ${agent.accent}`} key={agent.id}>
                <div className="agent-card-topline">
                  <span className={`status-dot ${agent.status === "active" ? "done" : agent.status === "ready" ? "running" : "waiting"}`} />
                  <code>{agentStatusText(agent.status)}</code>
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.scope}</p>
                <small>{agent.objective}</small>
                <div className="agent-tag-list">
                  {agent.triggers.slice(0, 3).map((trigger) => <span key={trigger}>{trigger}</span>)}
                </div>
                <div className="agent-card-actions">
                  <button className="icon-text-button" onClick={() => testAgentRoute(agent)}>
                    <Play size={16} />
                    <span>测试</span>
                  </button>
                  <button className="icon-text-button" onClick={() => editAgent(agent)}>
                    <SquarePen size={16} />
                    <span>编辑</span>
                  </button>
                  <button className="primary-button" onClick={() => useAgentInWorkbench(agent)}>
                    <Workflow size={16} />
                    <span>用于任务</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="agent-admin panel">
          <div className="panel-header">
            <div>
              <span>Agent 配置</span>
              <small>{agentAdminOpen ? `正在编辑：${selectedAgent.name}` : "点击卡片里的“编辑”后配置角色、工具、审批、渠道和输出。"}</small>
            </div>
            <button className="icon-text-button" onClick={() => setAgentAdminOpen((open) => !open)}>
              <Settings size={16} />
              <span>{agentAdminOpen ? "收起配置" : "展开配置"}</span>
            </button>
          </div>

          {agentAdminOpen ? (
            <div className="agent-admin-body">
              <div className="agent-admin-grid">
                <section className="agent-admin-section">
                  <h3>基础角色</h3>
                  <div className="agent-editor-grid">
                    <label className="agent-editor-field">
                      <span>名称</span>
                      <input value={selectedAgent.name} onChange={(event) => updateAgentSpec(selectedAgent.id, { name: event.target.value })} />
                    </label>
                    <label className="agent-editor-field">
                      <span>状态</span>
                      <select value={selectedAgent.status} onChange={(event) => updateAgentSpec(selectedAgent.id, { status: event.target.value as AgentSpec["status"] })}>
                        <option value="active">active</option>
                        <option value="ready">ready</option>
                        <option value="draft">draft</option>
                      </select>
                    </label>
                    <label className="agent-editor-field">
                      <span>模型</span>
                      <input value={selectedAgent.model} onChange={(event) => updateAgentSpec(selectedAgent.id, { model: event.target.value })} />
                    </label>
                    <label className="agent-editor-field">
                      <span>审批规则</span>
                      <select value={selectedAgent.policy} onChange={(event) => updateAgentSpec(selectedAgent.id, { policy: event.target.value as PermissionMode })}>
                        {permissionOptions.map((option) => (
                          <option value={option.id} key={option.id}>{permissionLabel(option.id)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="agent-editor-field">
                    <span>能力说明</span>
                    <input value={selectedAgent.scope} onChange={(event) => updateAgentSpec(selectedAgent.id, { scope: event.target.value })} />
                  </label>
                  <label className="agent-editor-field">
                    <span>目标</span>
                    <textarea value={selectedAgent.objective} onChange={(event) => updateAgentSpec(selectedAgent.id, { objective: event.target.value })} rows={3} />
                  </label>
                </section>

                <section className="agent-admin-section">
                  <h3>业务知识与输出</h3>
                  <label className="agent-editor-field">
                    <span>角色说明 / AGENTS.md 片段</span>
                    <textarea value={selectedAgent.systemPrompt} onChange={(event) => updateAgentSpec(selectedAgent.id, { systemPrompt: event.target.value })} rows={5} />
                  </label>
                  <div className="agent-field-columns">
                    {renderAgentListEditor(selectedAgent, "skills", "业务知识 / Skills")}
                    {renderAgentListEditor(selectedAgent, "metrics", "验收指标")}
                  </div>
                </section>
              </div>

              <section className="agent-admin-section">
                <h3>工具、渠道与外部系统</h3>
                <div className="agent-field-columns">
                  {renderAgentListEditor(selectedAgent, "tools", "可调用工具")}
                  {renderAgentListEditor(selectedAgent, "systems", "外部系统")}
                  {renderAgentListEditor(selectedAgent, "channels", "接入渠道")}
                  {renderAgentListEditor(selectedAgent, "triggers", "适用场景")}
                </div>
                <div className="agent-channel-strip">
                  {channelAdapters.map((adapter) => (
                    <button
                      className={selectedChannelAdapter.id === adapter.id ? "route-chip selected" : "route-chip"}
                      key={adapter.id}
                      onClick={() => setSelectedChannelAdapterId(adapter.id)}
                    >
                      {adapter.name} · {adapter.status}
                    </button>
                  ))}
                </div>
              </section>

              <section className="agent-admin-section">
                <div className="agent-stage-header">
                  <div>
                    <strong>编排阶段</strong>
                    <span>按业务流程组织：触发条件、动作、输出和负责方。</span>
                  </div>
                  <button className="icon-text-button" onClick={() => addAgentStage(selectedAgent.id)}>
                    <Plus size={16} />
                    <span>阶段</span>
                  </button>
                </div>
                <div className="agent-stage-list">
                  {selectedAgent.stages.map((stage, index) => (
                    <div className="agent-stage-card" key={`${selectedAgent.id}-${index}`}>
                      <div className="agent-stage-number">{index + 1}</div>
                      <div className="agent-stage-fields">
                        <input value={stage.name} onChange={(event) => updateAgentStage(selectedAgent.id, index, { name: event.target.value })} aria-label="阶段名称" />
                        <input value={stage.owner} onChange={(event) => updateAgentStage(selectedAgent.id, index, { owner: event.target.value })} aria-label="负责人" />
                        <textarea value={stage.trigger} onChange={(event) => updateAgentStage(selectedAgent.id, index, { trigger: event.target.value })} aria-label="触发条件" rows={2} />
                        <textarea value={stage.action} onChange={(event) => updateAgentStage(selectedAgent.id, index, { action: event.target.value })} aria-label="执行动作" rows={2} />
                        <textarea value={stage.output} onChange={(event) => updateAgentStage(selectedAgent.id, index, { output: event.target.value })} aria-label="输出" rows={2} />
                      </div>
                      <button className="icon-button ghost" onClick={() => removeAgentStage(selectedAgent.id, index)} title="删除阶段" disabled={selectedAgent.stages.length <= 1}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="agent-admin-empty">
              <Bot size={18} />
              <span>选择一个 Agent 并点击“编辑”，进入管理员配置。</span>
            </div>
          )}
        </section>

        <section className="agent-debug-panel panel">
          <button className="agent-debug-toggle" onClick={() => setAgentDebugOpen((open) => !open)}>
            <span>
              <strong>高级调试</strong>
              <small>Route Lab、Eval、Harness Snapshot、AgentSession、Skill Registry、Policy Gate</small>
            </span>
            <ChevronDown className={agentDebugOpen ? "rotated" : ""} size={18} />
          </button>

          {agentDebugOpen ? (
            <div className="agent-debug-content">
              <div className="agent-architecture-strip">
                <span>AgentSession</span>
                <span>Skill Registry</span>
                <span>External Connectors</span>
                <span>Policy Gate</span>
                <span>Artifact UI</span>
              </div>

              <section className="agent-lab">
                <div className="panel-header">
                  <div>
                    <span>Route Lab</span>
                    <small>解释输入如何经过 channel、intent、agent、model、tool、policy、context。</small>
                  </div>
                  <div className="agent-lab-actions">
                    <button className="icon-text-button" onClick={() => runRouteLab()} disabled={routeLabLoading}>
                      <GitBranch size={16} />
                      <span>{routeLabLoading ? "诊断中" : "诊断路由"}</span>
                    </button>
                    <button className="icon-text-button" onClick={runAgentEvalHarness} disabled={evalLoading}>
                      <Activity size={16} />
                      <span>{evalLoading ? "评估中" : "运行 Eval"}</span>
                    </button>
                    <button className="icon-text-button" onClick={refreshHarnessSnapshot} disabled={harnessLoading}>
                      <Database size={16} />
                      <span>{harnessLoading ? "刷新中" : "Harness 快照"}</span>
                    </button>
                  </div>
                </div>
                <div className="agent-lab-grid">
                  <label className="agent-editor-field route-lab-input">
                    <span>测试输入</span>
                    <textarea
                      value={routeLabPrompt}
                      onChange={(event) => setRouteLabPrompt(event.target.value)}
                      rows={4}
                      placeholder="例如：客人投诉房间异味，帮我分级并生成补救方案。"
                    />
                  </label>

                  <div className="route-lab-result">
                    <div className="route-pill-grid">
                      <div className="route-pill">
                        <span>Channel</span>
                        <strong>{routeLabResult ? channelRouteLabel(routeLabResult.channelAdapter) : activeChannelAdapter?.name || "Fiitx Workbench"}</strong>
                      </div>
                      <div className="route-pill">
                        <span>Intent</span>
                        <strong>{routeLabResult ? `${routeLabResult.intent.mode} / ${routeLabResult.intent.modality}` : "等待诊断"}</strong>
                        {routeLabResult?.intent.taskKind ? <small>{routeLabResult.intent.taskKind}</small> : null}
                      </div>
                      <div className="route-pill">
                        <span>Agent</span>
                        <strong>{routeLabResult?.selectedAgent?.name || "无业务 Agent"}</strong>
                        {routeLabResult?.selectedAgent?.reason ? <small>{routeLabResult.selectedAgent.reason}</small> : null}
                      </div>
                      <div className="route-pill">
                        <span>Model</span>
                        <strong>{routeLabResult ? modelRouteLabel(routeLabResult.selectedModel) : getRuntimeModelLabel()}</strong>
                        <small>{routeModelCandidates.length} 个候选</small>
                      </div>
                    </div>

                    <div className="route-detail-columns">
                      <div>
                        <strong>候选 Agent</strong>
                        <div className="route-chip-list">
                          {(routeLabResult?.agentCandidates ?? []).slice(0, 5).map((candidate) => (
                            <span className="route-chip" key={candidate.id}>{candidate.name} · {candidate.score}</span>
                          ))}
                          {routeLabResult && routeLabResult.agentCandidates.length === 0 ? <span className="route-muted">无命中</span> : null}
                        </div>
                      </div>
                      <div>
                        <strong>Tool Plan</strong>
                        <div className="route-chip-list">
                          {(routeLabResult?.toolPlan ?? []).map((tool) => <span className="route-chip" key={tool}>{tool}</span>)}
                          {routeLabResult && routeLabResult.toolPlan.length === 0 ? <span className="route-muted">无需工具</span> : null}
                        </div>
                      </div>
                      <div>
                        <strong>Context</strong>
                        <div className="route-context-list">
                          <span>线程：{boolRouteText(routeContextPlan.threadContext ?? routeContextPlan.hasThreadContext)}</span>
                          <span>通道：{boolRouteText(routeContextPlan.channelContext ?? routeContextPlan.hasChannelContext)}</span>
                          <span>
                            外部资料：{String(Array.isArray(routeContextPlan.externalUrls) ? routeContextPlan.externalUrls.length : routeContextPlan.externalUrlCount ?? 0)} 个
                          </span>
                          <span>附件：{String(routeContextPlan.attachments ?? routeContextPlan.attachmentCount ?? 0)} 个</span>
                        </div>
                      </div>
                      <div>
                        <strong>Policy</strong>
                        <div className="route-chip-list">
                          {routePolicyPlan.slice(0, 4).map((item, index) => {
                            const record = isRecord(item) ? item : {};
                            return (
                              <span className="route-chip" key={`${pickString(record, ["name", "action"], "policy")}-${index}`}>
                                {pickString(record, ["name", "action"], "policy")} · {pickString(record, ["mode", "risk"], "ask")}
                              </span>
                            );
                          })}
                          {routePolicyPlan.length === 0 ? <span className="route-muted">无工具策略</span> : null}
                        </div>
                      </div>
                    </div>

                    {routeLabResult?.deepseekHarnessChecks?.length ? (
                      <div className="route-harness-checks">
                        {routeLabResult.deepseekHarnessChecks.map((check) => <span key={check}>{check}</span>)}
                      </div>
                    ) : null}
                  </div>

                  <div className="agent-eval-card">
                    <div>
                      <strong>Eval Harness</strong>
                      <span>{evalResult ? `${evalResult.passed}/${evalResult.total} 通过` : "覆盖投诉、行程、小程序、外部文档、媒体路由"}</span>
                    </div>
                    {evalResult ? (
                      <div className="eval-case-list">
                        {evalResult.results.map((item) => (
                          <span className={item.ok ? "pass" : "fail"} key={item.id}>
                            {item.ok ? "通过" : "失败"} · {item.id}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {failedEvalCases.length ? (
                      <small>失败用例：{failedEvalCases.map((item) => item.id).join("、")}</small>
                    ) : null}
                  </div>

                  <div className="agent-eval-card">
                    <div>
                      <strong>Harness Snapshot</strong>
                      <span>{harnessSnapshot ? `${harnessSnapshot.toolCount} 个工具 · ${harnessSnapshot.models.length} 个模型 · ${harnessSnapshot.sessions.length} 个 session` : "查看当前 runtime 暴露能力"}</span>
                    </div>
                    {harnessSnapshot ? (
                      <div className="route-chip-list">
                        {harnessSnapshot.tools.slice(0, 6).map((tool, index) => (
                          <span className="route-chip" key={`${pickString(tool, ["name", "label"], "tool")}-${index}`}>{pickString(tool, ["name", "label"], "tool")}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="agent-debug-grid">
                <div className="agents-list">
                  <div className="panel-header">
                    <div>
                      <span>Skill Registry</span>
                      <small>{agentSpecs.length} 个 Agent · {activeCount} 个 active</small>
                    </div>
                    <button className="icon-text-button" onClick={resetAgentSpecs} title="恢复默认行业模板">
                      <RefreshCw size={16} />
                      <span>重置</span>
                    </button>
                  </div>
                  <div className="agent-stack">
                    {agentSpecs.map((agent) => (
                      <button
                        className={selectedAgent.id === agent.id ? `agent-row active ${agent.accent}` : `agent-row ${agent.accent}`}
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                      >
                        <span className={`status-dot ${agent.status === "active" ? "done" : agent.status === "ready" ? "running" : "waiting"}`} />
                        <span>
                          <strong>{agent.name}</strong>
                          <small>{agent.scope}</small>
                        </span>
                        <code>{agent.policy}</code>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="agent-preview">
                  <div className="panel-header">
                    <div>
                      <span>Channel Adapters</span>
                      <small>{channelAdapters.length} 个 adapter · {activeChannelCount} 个 active · 当前 {activeChannelAdapter?.name || "未选择"}</small>
                    </div>
                    <button className="icon-text-button" onClick={resetChannelAdapters} title="恢复默认 Channel adapters">
                      <RefreshCw size={16} />
                      <span>重置</span>
                    </button>
                  </div>
                  <div className="agent-stack">
                    {channelAdapters.map((adapter) => (
                      <button
                        className={selectedChannelAdapter.id === adapter.id ? "agent-row active blue" : "agent-row blue"}
                        key={adapter.id}
                        onClick={() => setSelectedChannelAdapterId(adapter.id)}
                      >
                        <span className={`status-dot ${adapter.status === "active" ? "done" : adapter.status === "ready" ? "running" : "waiting"}`} />
                        <span>
                          <strong>{adapter.name}</strong>
                          <small>{adapter.description}</small>
                        </span>
                        <code>{adapter.channelType === "wechat-miniprogram-ai" ? "wechat" : "desktop"}</code>
                      </button>
                    ))}
                  </div>
                  <div className="agent-stage-header">
                    <div>
                      <strong>Channel Manifest</strong>
                      <span>{"横向底座：channel -> context -> route bias -> followUp -> reply contract"}</span>
                    </div>
                    <button className="primary-button" onClick={() => activateChannelAdapter(selectedChannelAdapter.id)}>
                      <MessageSquare size={16} />
                      <span>设为当前通道</span>
                    </button>
                  </div>
                  <div className="agent-manifest channel-manifest">
                    <pre>{channelManifest}</pre>
                  </div>
                  <div className="panel-header">
                    <div>
                      <span>Agent Manifest</span>
                      <small>AGENTS.md / SKILL.md / mcp.json 草案</small>
                    </div>
                    <button className="icon-text-button" onClick={() => copyText(manifest)}>
                      <Copy size={16} />
                      <span>复制</span>
                    </button>
                  </div>
                  <div className="agent-manifest">
                    <pre>{manifest}</pre>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  function renderApprovals() {
    return (
      <div className="approval-layout panel">
        <div className="panel-header">
          <div>
            <span>权限审批队列</span>
            <small>Shell、网络、文件写入和敏感读取</small>
          </div>
        </div>
        <div className="approval-table">
          {approvals.length === 0 ? <div className="empty-state">暂无审批动作</div> : null}
          {approvals.map((approval) => (
            <div className={`approval-row ${approval.status}`} key={approval.id}>
              <div className="approval-risk">
                <AlertTriangle size={17} />
                <span>{riskLabel(approval.risk)}</span>
              </div>
              <div className="approval-content">
                <strong>{approval.title}</strong>
                <p>{approval.detail}</p>
                <code>{approval.command}</code>
              </div>
              <div className="approval-requester">{approval.requester}</div>
              <div className="approval-status">{approval.status}</div>
              <div className="approval-actions">
                <button className="icon-button success" title="批准" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "approved")}>
                  <Check size={16} />
                </button>
                <button className="icon-button danger" title="拒绝" disabled={approval.status !== "pending"} onClick={() => resolveApproval(approval.id, "denied")}>
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function formatHistoryTime(value?: string | number) {
    if (!value) {
      return "n/a";
    }
    const date = typeof value === "number" ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function historyStatusLabel(status?: string) {
    if (status === "done" || status === "complete") {
      return "已完成";
    }
    if (status === "waiting" || status === "needs-review") {
      return "需复盘";
    }
    if (status === "running") {
      return "运行中";
    }
    return status || "未知";
  }

  function versionDisplayName(version: FiitxAgentVersionSnapshot) {
    return `${version.name} · ${version.version}`;
  }

  function versionSelectKey(version: FiitxAgentVersionSnapshot) {
    return `${version.id}:${version.version}`;
  }

  function versionBody(version?: FiitxAgentVersionSnapshot | null) {
    if (!version) {
      return "";
    }
    return [
      version.body || "",
      JSON.stringify(version.metadata || {}, null, 2)
    ].filter(Boolean).join("\n\n");
  }

  function buildVersionDiffRows(left?: FiitxAgentVersionSnapshot, right?: FiitxAgentVersionSnapshot) {
    const leftLines = versionBody(left).split(/\r?\n/);
    const rightLines = versionBody(right).split(/\r?\n/);
    const length = Math.max(leftLines.length, rightLines.length);
    return Array.from({ length }, (_, index) => ({
      index: index + 1,
      left: leftLines[index] ?? "",
      right: rightLines[index] ?? "",
      changed: (leftLines[index] ?? "") !== (rightLines[index] ?? "")
    })).filter((row) => row.changed).slice(0, 80);
  }

  function renderHistory() {
    const historyThreads = historySnapshot?.threads ?? [];
    const telemetrySummary = (isRecord(historySnapshot?.telemetrySummary) ? historySnapshot?.telemetrySummary : {}) as Record<string, unknown>;
    const allVersions = [
      ...(historyTrace?.promptVersions ?? historySnapshot?.promptVersions ?? []),
      ...(historyTrace?.policyVersions ?? historySnapshot?.policyVersions ?? [])
    ];
    const versionLeft = allVersions.find((version) => versionSelectKey(version) === versionDiffLeftId) ?? allVersions[0];
    const versionRight = allVersions.find((version) => versionSelectKey(version) === versionDiffRightId) ?? allVersions.find((version) => versionSelectKey(version) !== (versionLeft ? versionSelectKey(versionLeft) : "")) ?? allVersions[0];
    const versionDiffRows = buildVersionDiffRows(versionLeft, versionRight);
    const successRate = typeof telemetrySummary.successRate === "number" ? `${Math.round(telemetrySummary.successRate * 100)}%` : "n/a";
    const selectedThread = historyThreads.find((thread) => thread.id === selectedHistoryThreadId);

    return (
      <div className="history-layout">
        <section className="history-hero panel">
          <div>
            <span className="eyebrow">Agent History</span>
            <h2>Trace、版本、复盘和审计包</h2>
            <p>按任务串起消息、工具、策略、产物和 telemetry，避免“显示已完成但实际没落地”的状态误判。</p>
          </div>
          <div className="history-actions">
            <button className="icon-text-button" onClick={refreshHistorySnapshot} disabled={historyLoading}>
              <RefreshCw size={16} />
              <span>{historyLoading ? "刷新中" : "刷新"}</span>
            </button>
            <button className="icon-text-button" onClick={() => void exportHistoryAudit()}>
              <Download size={16} />
              <span>导出当前 Trace</span>
            </button>
          </div>
        </section>

        <section className="history-metric-grid">
          <div className="history-metric panel">
            <span>线程</span>
            <strong>{historyThreads.length}</strong>
            <small>可追踪任务</small>
          </div>
          <div className="history-metric panel">
            <span>Run</span>
            <strong>{String(telemetrySummary.totalRuns ?? 0)}</strong>
            <small>成功率 {successRate}</small>
          </div>
          <div className="history-metric panel warn">
            <span>失败 / 需复盘</span>
            <strong>{String(historySnapshot?.failedRuns ?? 0)}</strong>
            <small>来自 run_end 和 warning</small>
          </div>
          <div className="history-metric panel">
            <span>版本</span>
            <strong>{allVersions.length}</strong>
            <small>Prompt / Policy snapshots</small>
          </div>
        </section>

        <section className="history-main-grid">
          <div className="history-list panel">
            <div className="panel-header">
              <div>
                <span>任务 Trace</span>
                <small>点击查看执行链路</small>
              </div>
            </div>
            <div className="history-run-list">
              {historyThreads.length === 0 ? <div className="empty-state">暂无历史任务</div> : null}
              {historyThreads.map((thread) => (
                <button
                  className={selectedHistoryThreadId === thread.id ? "history-run-row active" : "history-run-row"}
                  key={thread.id}
                  onClick={() => void openHistoryTrace(thread.id)}
                >
                  <span className={`status-dot ${thread.status === "done" ? "green" : thread.status === "running" ? "blue" : "orange"}`} />
                  <div>
                    <strong>{thread.title}</strong>
                    <small>{thread.kind} · {historyStatusLabel(thread.status)} · {formatHistoryTime(thread.updatedAt || thread.createdAt)}</small>
                    {thread.lastProgressTitle ? <em>{thread.lastProgressTitle}</em> : null}
                  </div>
                  <span>{thread.artifactCount} 产物</span>
                </button>
              ))}
            </div>
          </div>

          <div className="trace-panel panel">
            <div className="panel-header">
              <div>
                <span>{selectedThread?.title || historyTrace?.threadId || "Trace 详情"}</span>
                <small>{historyTrace ? `${historyTrace.timeline.length} 个事件 · ${historyTrace.toolNames.length} 个工具` : "选择一个任务查看完整链路"}</small>
              </div>
              <div className="history-actions compact">
                <button className="icon-text-button" disabled={!historyTrace} onClick={() => historyTrace ? copyText(JSON.stringify(historyTrace, null, 2)) : undefined}>
                  <Copy size={15} />
                  <span>复制 Trace</span>
                </button>
                <button className="icon-text-button" disabled={!historyTrace} onClick={() => historyTrace ? void exportHistoryAudit(historyTrace.threadId) : undefined}>
                  <Download size={15} />
                  <span>审计包</span>
                </button>
              </div>
            </div>

            {historyTrace ? (
              <>
                <div className={`trace-review ${historyTrace.analysis.status}`}>
                  <div>
                    <strong>{historyTrace.analysis.headline}</strong>
                    <span>{historyTrace.analysis.findings[0]}</span>
                  </div>
                  <b>{historyStatusLabel(historyTrace.analysis.status)}</b>
                </div>

                <div className="trace-two-column">
                  <section>
                    <h3>失败任务复盘</h3>
                    <ul className="trace-list">
                      {historyTrace.analysis.findings.map((finding, index) => <li key={`finding-${index}`}>{finding}</li>)}
                    </ul>
                  </section>
                  <section>
                    <h3>下一步动作</h3>
                    <ul className="trace-list">
                      {historyTrace.analysis.nextActions.map((action, index) => <li key={`action-${index}`}>{action}</li>)}
                    </ul>
                  </section>
                </div>

                <div className="trace-metrics">
                  {Object.entries(historyTrace.analysis.metrics).map(([key, value]) => (
                    <div key={key}>
                      <span>{key}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>

                <div className="trace-timeline">
                  {historyTrace.timeline.slice(-80).map((item) => (
                    <div className={`trace-step ${item.status}`} key={`${item.source}-${item.id}`}>
                      <span>{formatHistoryTime(item.time)}</span>
                      <div>
                        <strong>{item.source} · {item.title}</strong>
                        <p>{item.detail || "无详情"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">选择左侧任务后显示 Trace 时间线和失败复盘。</div>
            )}
          </div>
        </section>

        <section className="history-main-grid secondary">
          <div className="version-panel panel">
            <div className="panel-header">
              <div>
                <span>Prompt / Policy 版本 Diff</span>
                <small>按配置 hash 记录 Agent、Channel 和 Policy 变化</small>
              </div>
            </div>
            <div className="version-diff-controls">
              <select value={versionLeft ? versionSelectKey(versionLeft) : ""} onChange={(event) => setVersionDiffLeftId(event.target.value)}>
                {allVersions.map((version) => <option key={`left-${version.id}-${version.version}`} value={versionSelectKey(version)}>{versionDisplayName(version)}</option>)}
              </select>
              <select value={versionRight ? versionSelectKey(versionRight) : ""} onChange={(event) => setVersionDiffRightId(event.target.value)}>
                {allVersions.map((version) => <option key={`right-${version.id}-${version.version}`} value={versionSelectKey(version)}>{versionDisplayName(version)}</option>)}
              </select>
            </div>
            <div className="version-diff-list">
              {allVersions.length === 0 ? <div className="empty-state">暂无版本快照</div> : null}
              {versionDiffRows.length === 0 && allVersions.length > 0 ? <div className="empty-state">两个版本没有文本差异</div> : null}
              {versionDiffRows.map((row) => (
                <div className="version-diff-row" key={`diff-${row.index}`}>
                  <code>{row.index}</code>
                  <pre>{row.left || " "}</pre>
                  <pre>{row.right || " "}</pre>
                </div>
              ))}
            </div>
          </div>

          <div className="compare-panel panel">
            <div className="panel-header">
              <div>
                <span>Run Compare</span>
                <small>比较两个任务的指标、工具、产物和失败原因</small>
              </div>
            </div>
            <div className="run-compare-controls">
              <select value={compareLeftThreadId} onChange={(event) => setCompareLeftThreadId(event.target.value)}>
                {historyThreads.map((thread) => <option key={`compare-left-${thread.id}`} value={thread.id}>{thread.title}</option>)}
              </select>
              <select value={compareRightThreadId} onChange={(event) => setCompareRightThreadId(event.target.value)}>
                {historyThreads.map((thread) => <option key={`compare-right-${thread.id}`} value={thread.id}>{thread.title}</option>)}
              </select>
              <button className="icon-text-button" onClick={compareHistoryRuns} disabled={!compareLeftThreadId || !compareRightThreadId}>
                <GitBranch size={16} />
                <span>比较</span>
              </button>
            </div>
            {historyCompare ? (
              <div className="compare-result">
                {historyCompare.diff.summary.map((line, index) => <p key={`summary-${index}`}>{line}</p>)}
                <div className="compare-metrics">
                  {historyCompare.diff.metrics.map((metric) => (
                    <div key={metric.key}>
                      <span>{metric.key}</span>
                      <strong>{metric.left} / {metric.right}</strong>
                      <b className={metric.delta === 0 ? "" : metric.delta > 0 ? "up" : "down"}>{metric.delta > 0 ? `+${metric.delta}` : metric.delta}</b>
                    </div>
                  ))}
                </div>
                <div className="compare-tags">
                  <strong>Shared tools</strong>
                  {(historyCompare.diff.tools.shared.length ? historyCompare.diff.tools.shared : ["none"]).map((tool) => <span key={`tool-${tool}`}>{tool}</span>)}
                </div>
              </div>
            ) : (
              <div className="empty-state">选择两个任务后比较运行差异。</div>
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderAudit() {
    return (
      <div className="audit-layout panel">
        <div className="panel-header">
          <div>
            <span>审计日志</span>
            <small>任务、模型、工具和策略事件</small>
          </div>
          <button className="icon-text-button" onClick={() => void exportHistoryAudit()}>
            <Download size={16} />
            <span>诊断包</span>
          </button>
        </div>
        <div className="audit-table">
          {auditLogs.length === 0 ? <div className="empty-state">暂无审计事件</div> : null}
          {auditLogs.map((log) => (
            <div className={`audit-row ${log.level}`} key={log.id}>
              <span>{log.time}</span>
              <strong>{log.actor}</strong>
              <p>{log.event}</p>
              <code>{log.target}</code>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPolicySettings() {
    const policyRows = [
      ["web.fetch_url", "外部文档读取", "读取用户消息中的 URL，并作为 pi transformContext 外部上下文。"],
      ["workspace.scan", "Workspace 扫描", "读取文件列表和安全文本片段，构建 coding 上下文。"],
      ["workspace.write_manifest", "文件写入", "模型返回 file manifest 后写入当前 workspace。"],
      ["mcp.read", "MCP 资源读取", "列出或读取 MCP server 暴露的 resources/prompts。"],
      ["mcp.tool.call", "MCP 工具调用", "调用外部 MCP server 的工具，并纳入审批、审计和执行过程。"],
      ["shell.exec", "Shell 命令", "执行 bash/npm/git 等本地命令。"],
      ["network.request", "网络访问", "访问外部 URL、下载依赖或查询远程资源。"],
      ["sensitive.read", "敏感读取", "读取 .env、ssh key、token、证书等敏感文件。"]
    ] as const;

    return (
      <div className="settings-layout policy-settings-layout">
        <div className="settings-column">
          <section className="panel policy-panel">
            <div className="panel-header">
              <div>
                <span>安全策略</span>
                <small>默认企业级边界</small>
              </div>
            </div>
            <div className="policy-controls">
              <label>
                <span>默认权限</span>
                <select value={policySettings.defaultPermissionMode} onChange={(event) => setDefaultPolicyMode(event.target.value as PermissionMode)}>
                  {permissionOptions.map((option) => <option key={option.id} value={option.id}>{permissionLabel(option.id)}</option>)}
                </select>
              </label>
              <label>
                <span>工具执行</span>
                <select value={policySettings.toolExecution} onChange={(event) => setPolicySettings((current) => ({ ...current, toolExecution: event.target.value as PolicySettings["toolExecution"] }))}>
                  <option value="sequential">sequential</option>
                  <option value="parallel">parallel</option>
                </select>
              </label>
              <label>
                <span>Sandbox</span>
                <select value={policySettings.sandboxMode} onChange={(event) => setPolicySettings((current) => ({ ...current, sandboxMode: event.target.value as PolicySettings["sandboxMode"] }))}>
                  <option value="read-only">read-only</option>
                  <option value="workspace-write">workspace-write</option>
                  <option value="danger-full-access">danger-full-access</option>
                </select>
              </label>
            </div>
            {policyRows.map(([action, title, detail]) => (
              <div className="policy-row" key={action}>
                <ShieldCheck size={18} />
                <div>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                  <code>{action}</code>
                </div>
                <select value={policySettings.actionModes[action] ?? "ask"} onChange={(event) => setPolicyActionMode(action, event.target.value as ToolPolicyMode)}>
                  <option value="ask">请求批准</option>
                  <option value="auto">替我审批</option>
                  <option value="full">完全访问</option>
                  <option value="block">禁止</option>
                </select>
              </div>
            ))}
          </section>
        </div>

        <div className="settings-column">
          <section className="panel metrics-panel">
            <div className="panel-header">
              <div>
                <span>本地状态</span>
                <small>桌面客户端</small>
              </div>
            </div>
            <div className="metric-grid">
              <div>
                <Database size={18} />
                <strong>SQLite</strong>
                <span>session / history</span>
              </div>
              <div>
                <Terminal size={18} />
                <strong>Sandbox</strong>
                <span>tool runtime</span>
              </div>
              <div>
                <Eye size={18} />
                <strong>Audit</strong>
                <span>{auditLogs.length} events</span>
              </div>
              <div>
                <MessageSquare size={18} />
                <strong>Threads</strong>
                <span>{threads.length} active</span>
              </div>
              <div>
                <KeyRound size={18} />
                <strong>Keychain</strong>
                <span>{encryptionAvailable ? "available" : "unavailable"}</span>
              </div>
              <div>
                <Shield size={18} />
                <strong>Default</strong>
                <span>{policySettings.defaultPermissionMode}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderMcpSettings() {
    const mcpServers = Object.values(mcpConfig?.mcpServers ?? {});
    const currentMcpSnapshot = mcpSnapshot ?? harnessSnapshot?.mcp ?? null;
    const mcpTools = currentMcpSnapshot?.tools ?? [];
    const mcpResources = currentMcpSnapshot?.resources ?? [];
    const mcpPrompts = currentMcpSnapshot?.prompts ?? [];

    return (
      <div className="settings-single-page integration-management-page">
        <section className="integration-hero">
          <div>
            <h3>MCP servers</h3>
            <p>Connect external tools and data sources. Fiitx will discover tools, resources and prompts, then route calls through policy approval and audit.</p>
            <small>{mcpConfig?.path || "mcp.json 未加载"}</small>
          </div>
          <div className="integration-hero-actions">
            <button className="icon-text-button" onClick={() => loadMcpManagement(true)} disabled={mcpLoading}>
              <RefreshCw size={16} />
              <span>{mcpLoading ? "刷新中" : "刷新"}</span>
            </button>
          </div>
        </section>

        <section className="integration-section">
          <div className="integration-section-header">
            <h4>Servers</h4>
            <button
              className="integration-add-button"
              onClick={() => {
                resetMcpForm();
                setMcpFormOpen(true);
              }}
              type="button"
            >
              <Plus size={17} />
              <span>Add server</span>
            </button>
          </div>

          <div className="mcp-server-list">
            {mcpServers.length === 0 ? <div className="integration-empty">暂无 MCP server。点击 Add server 添加。</div> : null}
            {mcpServers.map((server) => {
              const enabled = server.enabled !== false;
              const discovered = (currentMcpSnapshot?.servers || []).find((item) => pickString(item, ["id"], "") === server.id);
              const connection = server.enabled === false ? "disabled" : pickString(discovered, ["connected"], "enabled");
              return (
                <div className="mcp-server-row" key={server.id}>
                  <div>
                    <strong>{server.name || server.id}</strong>
                    <span>{server.type || "stdio"} · {connection}</span>
                    <code>{server.type === "stdio" ? `${server.command || ""} ${(server.args || []).join(" ")}` : server.url}</code>
                  </div>
                  <button className="icon-button ghost" onClick={() => editMcpServer(server)} title="配置">
                    <Settings size={16} />
                  </button>
                  <label className="switch-control" title={enabled ? "停用" : "启用"}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={mcpLoading}
                      onChange={(event) => void toggleMcpServerEnabled(server, event.target.checked)}
                    />
                    <span />
                  </label>
                </div>
              );
            })}
          </div>

          {mcpStatusMessage ? <div className="integration-status">{mcpStatusMessage}</div> : null}
        </section>

        {mcpFormOpen ? (
          <section className="panel integration-panel">
            <div className="panel-header">
              <div>
                <span>{mcpForm.id ? "编辑 MCP Server" : "Add server"}</span>
                <small>支持 stdio、SSE 和 Streamable HTTP。</small>
              </div>
              <button className="icon-button ghost" onClick={resetMcpForm} type="button" title="关闭">
                <X size={16} />
              </button>
            </div>

            <div className="integration-form">
              <label>
                <span>Server ID</span>
                <input value={mcpForm.id} onChange={(event) => setMcpForm((current) => ({ ...current, id: event.target.value }))} placeholder="filesystem" />
              </label>
              <label>
                <span>名称</span>
                <input value={mcpForm.name || ""} onChange={(event) => setMcpForm((current) => ({ ...current, name: event.target.value }))} placeholder="Filesystem MCP" />
              </label>
              <label>
                <span>Transport</span>
                <select value={mcpForm.type || "stdio"} onChange={(event) => setMcpForm((current) => ({ ...current, type: event.target.value as FiitxMcpServerConfig["type"] }))}>
                  <option value="stdio">stdio</option>
                  <option value="streamable-http">streamable-http</option>
                  <option value="sse">sse</option>
                </select>
              </label>
              {mcpForm.type === "stdio" ? (
                <>
                  <label className="wide">
                    <span>Command</span>
                    <input value={mcpForm.command || ""} onChange={(event) => setMcpForm((current) => ({ ...current, command: event.target.value }))} placeholder="npx" />
                  </label>
                  <label className="wide">
                    <span>Args JSON 或空格分隔</span>
                    <input value={mcpArgsText} onChange={(event) => setMcpArgsText(event.target.value)} placeholder='["@modelcontextprotocol/server-filesystem", "/path"]' />
                  </label>
                  <label className="wide">
                    <span>CWD</span>
                    <input value={mcpForm.cwd || ""} onChange={(event) => setMcpForm((current) => ({ ...current, cwd: event.target.value }))} placeholder="可选" />
                  </label>
                </>
              ) : (
                <label className="wide">
                  <span>URL</span>
                  <input value={mcpForm.url || ""} onChange={(event) => setMcpForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.com/mcp" />
                </label>
              )}
              <label>
                <span>风险</span>
                <select value={mcpForm.risk || "medium"} onChange={(event) => setMcpForm((current) => ({ ...current, risk: event.target.value as FiitxMcpServerConfig["risk"] }))}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <label>
                <span>超时 ms</span>
                <input type="number" value={mcpForm.timeoutMs || 12000} onChange={(event) => setMcpForm((current) => ({ ...current, timeoutMs: Number(event.target.value) }))} />
              </label>
              <label className="checkbox-field">
                <input type="checkbox" checked={mcpForm.enabled !== false} onChange={(event) => setMcpForm((current) => ({ ...current, enabled: event.target.checked }))} />
                <span>启用</span>
              </label>
              <label className="wide">
                <span>Env JSON</span>
                <textarea value={mcpEnvText} onChange={(event) => setMcpEnvText(event.target.value)} rows={3} />
              </label>
              <label className="wide">
                <span>Headers JSON</span>
                <textarea value={mcpHeadersText} onChange={(event) => setMcpHeadersText(event.target.value)} rows={3} />
              </label>
              <div className="integration-actions">
                <button className="primary-button" onClick={saveMcpServerFromForm} disabled={mcpLoading}>
                  <Save size={16} />
                  <span>保存 Server</span>
                </button>
                {mcpForm.id ? (
                  <button className="icon-text-button" onClick={() => deleteMcpServer(mcpForm.id)} disabled={mcpLoading} type="button">
                    <X size={16} />
                    <span>删除</span>
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="integration-capability-grid mcp-capability-grid">
          <div>
            <strong>Tools</strong>
            <span>{mcpTools.length}</span>
            <div className="route-chip-list">
              {mcpTools.slice(0, 8).map((tool, index) => <span className="route-chip" key={`mcp-tool-${index}`}>{pickString(tool, ["fiitxToolName", "name"], "tool")}</span>)}
            </div>
          </div>
          <div>
            <strong>Resources</strong>
            <span>{mcpResources.length}</span>
            <div className="route-chip-list">
              {mcpResources.slice(0, 5).map((resource, index) => <span className="route-chip" key={`mcp-resource-${index}`}>{pickString(resource, ["name", "uri"], "resource")}</span>)}
            </div>
          </div>
          <div>
            <strong>Prompts</strong>
            <span>{mcpPrompts.length}</span>
            <div className="route-chip-list">
              {mcpPrompts.slice(0, 5).map((prompt, index) => <span className="route-chip" key={`mcp-prompt-${index}`}>{pickString(prompt, ["name"], "prompt")}</span>)}
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderSkillSettings() {
    const query = skillSearch.trim().toLowerCase();
    const skillMatches = (skill: unknown) => {
      if (!query) {
        return true;
      }
      return [
        pickString(skill, ["name", "id"], ""),
        pickString(skill, ["description", "summary"], ""),
        pickString(skill, ["root", "source"], "")
      ].join(" ").toLowerCase().includes(query);
    };
    const visibleInstalledSkills = installedSkills.filter(skillMatches);
    const visibleCatalogSkills = skillCatalog.filter(skillMatches);

    return (
      <div className="settings-single-page skill-management-page">
        <section className="integration-hero">
          <div>
            <h3>Skills</h3>
            <p>Extend Fiitx with task-specific skills. Installed skills can contribute prompts, MCP servers, tools and workflow instructions.</p>
          </div>
          <div className="integration-hero-actions">
            <button className="icon-text-button" onClick={loadSkillManagement} disabled={skillLoading}>
              <RefreshCw size={16} />
              <span>{skillLoading ? "加载中" : "刷新"}</span>
            </button>
          </div>
        </section>

        <div className="skill-search-row">
          <label className="skill-search">
            <Search size={18} />
            <input value={skillSearch} onChange={(event) => setSkillSearch(event.target.value)} placeholder="Search skills" />
          </label>
          <button className="icon-text-button" onClick={() => setSkillInstallRoot((current) => current || workspacePath)} type="button">
            <Plus size={16} />
            <span>本地 Skill</span>
          </button>
        </div>

        <section className="panel integration-panel local-skill-install-panel">
          <div className="panel-header">
            <div>
              <span>安装本地 Skill</span>
              <small>选择包含 SKILL.md 或 mcp.json 的目录。</small>
            </div>
          </div>

          <div className="integration-form single">
            <label className="wide">
              <span>本地 Skill Root</span>
              <input value={skillInstallRoot} onChange={(event) => setSkillInstallRoot(event.target.value)} placeholder="/path/to/skill-with-SKILL.md-or-mcp.json" />
            </label>
            <div className="integration-actions">
              <button className="icon-text-button" onClick={() => installSkill(skillInstallRoot)} disabled={skillLoading || !skillInstallRoot.trim()}>
                <Plus size={16} />
                <span>安装本地 Skill</span>
              </button>
            </div>
          </div>

          {skillStatusMessage ? <div className="integration-status">{skillStatusMessage}</div> : null}
        </section>

        <section className="skill-list-section">
          <h4>Installed</h4>
          <div className="skill-list">
            {visibleInstalledSkills.length === 0 ? <div className="integration-empty">暂无已安装 Skill。</div> : null}
            {visibleInstalledSkills.map((skill, index) => {
              const id = pickString(skill, ["id"], `skill-${index}`);
              const enabled = !(isRecord(skill) && skill.enabled === false);
              const source = pickString(skill, ["source"], "local");
              const hasError = Boolean(isRecord(skill) && skill.error);
              return (
                <div className={`skill-row ${enabled ? "" : "disabled"} ${hasError ? "error" : ""}`} key={id}>
                  <div className="skill-icon">
                    <Store size={18} />
                  </div>
                  <div className="skill-main">
                    <strong>{pickString(skill, ["name", "id"], id)}</strong>
                    <span>{hasError ? pickString(skill, ["error"], "Skill 读取失败") : pickString(skill, ["description", "summary"], pickString(skill, ["root"], "本地 Skill"))}</span>
                    <small>{pickString(skill, ["version"], "0.0.0")} · {source} · {enabled ? "enabled" : "disabled"}</small>
                  </div>
                  <button className={`skill-toggle ${enabled ? "on" : ""}`} onClick={() => toggleInstalledSkill(id, !enabled)} title={enabled ? "停用" : "启用"}>
                    <span />
                  </button>
                  <button className="icon-button ghost" onClick={() => uninstallSkill(id)} title="卸载">
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="skill-list-section">
          <h4>Local Catalog</h4>
          <div className="skill-list">
            {visibleCatalogSkills.length === 0 ? <div className="integration-empty">暂无匹配的 Catalog Skill。</div> : null}
            {visibleCatalogSkills.slice(0, 16).map((skill, index) => {
              const root = pickString(skill, ["root"], "");
              return (
                <div className="skill-row" key={`${root}-${index}`}>
                  <div className="skill-icon cube">
                    <Folder size={18} />
                  </div>
                  <div className="skill-main">
                    <strong>{pickString(skill, ["name", "id"], "Skill")}</strong>
                    <span>{pickString(skill, ["description", "summary"], root || "本地可安装 Skill")}</span>
                    <small>{pickString(skill, ["version", "source"], "local-catalog")}</small>
                  </div>
                  <button className="icon-button ghost" onClick={() => installSkill(root)} title="安装">
                    <Plus size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderAboutSettings() {
    return (
      <div className="settings-single-page">
        <section className="panel about-panel">
          <div className="about-hero">
            <img src={logoUrl} alt={PRODUCT_NAME} />
            <div>
              <span>{t("about.eyebrow")}</span>
              <h2>{PRODUCT_NAME}</h2>
              <p>{PRODUCT_EYEBROW}</p>
            </div>
          </div>
          <div className="about-copy">
            <p>{t("about.copy1")}</p>
            <p>{t("about.copy2")}</p>
          </div>
          <div className="about-info-grid">
            <div>
              <span>{t("about.platform")}</span>
              <strong>{platform}</strong>
            </div>
            <div>
              <span>{t("about.version")}</span>
              <strong>v0.1.0</strong>
            </div>
            <div>
              <span>{t("about.secureStorage")}</span>
              <strong>{encryptionAvailable ? t("about.keychainAvailable") : t("about.keychainUnavailable")}</strong>
            </div>
            <div>
              <span>{t("about.workspace")}</span>
              <strong>{workspacePath || t("about.notSelected")}</strong>
            </div>
            <div>
              <span>{t("settings.language")}</span>
              <label className="language-select">
                <select value={uiLocale} onChange={(event) => updateUiLocale(event.target.value as UiLocale)}>
                  {supportedLocales.map((locale) => (
                    <option key={locale.id} value={locale.id}>
                      {locale.nativeName} · {locale.englishName}
                    </option>
                  ))}
                </select>
              </label>
              <small>{t("settings.languageHelp")}</small>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderSettingsPageContent() {
    if (activeSettingsPage === "models") {
      return renderModels();
    }
    if (activeSettingsPage === "agents") {
      return renderAgents();
    }
    if (activeSettingsPage === "approvals") {
      return renderApprovals();
    }
    if (activeSettingsPage === "history") {
      return renderHistory();
    }
    if (activeSettingsPage === "audit") {
      return renderAudit();
    }
    if (activeSettingsPage === "mcp") {
      return renderMcpSettings();
    }
    if (activeSettingsPage === "skills") {
      return renderSkillSettings();
    }
    if (activeSettingsPage === "about") {
      return renderAboutSettings();
    }
    return renderPolicySettings();
  }

  function renderSettings() {
    const activeSettingsItem = settingsNavItems.find((item) => item.id === activeSettingsPage) ?? settingsNavItems[0];

    return (
      <div className="settings-page">
        <aside className="settings-sidebar">
          <button className="settings-back-button" onClick={() => setActiveView("workbench")} type="button">
            <ArrowLeft size={17} />
            <span>{t("settings.back")}</span>
          </button>
          {settingsNavGroups.map((group) => (
            <div className="settings-nav-group" key={group.title}>
              <div className="settings-nav-heading">{t("settings.group")}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className={activeSettingsPage === item.id ? "settings-nav-item active" : "settings-nav-item"}
                    key={item.id}
                    onClick={() => setActiveSettingsPage(item.id)}
                    type="button"
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{settingsLabel(item.id)}</strong>
                      <small>{settingsDescription(item.id)}</small>
                    </span>
                    {item.id === "approvals" && pendingApprovalCount > 0 ? <b className="nav-badge">{pendingApprovalCount}</b> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
        <section className="settings-detail">
          <div className="settings-detail-header">
            <span>{t("settings.eyebrow")}</span>
            <h2>{activeSettingsItem ? settingsLabel(activeSettingsItem.id) : t("settings.fallbackTitle")}</h2>
            <p>{activeSettingsItem ? settingsDescription(activeSettingsItem.id) : t("settings.fallbackDesc")}</p>
          </div>
          <div className="settings-detail-body">
            {renderSettingsPageContent()}
          </div>
        </section>
      </div>
    );
  }

  function renderContent() {
    if (activeView === "settings") {
      return renderSettings();
    }
    return renderWorkbench();
  }

  function renderTerminalPanel() {
    const promptLabel = `(base) botbotbot@botbotmac ${getTerminalWorkspaceLabel()} %`;

    return (
      <section className="terminal-panel">
        <div className="terminal-tabs">
          <button className="terminal-tab active">
            <Terminal size={15} />
            <span>{PRODUCT_NAME}</span>
          </button>
          <button className="terminal-tab plus" title={t("terminal.new")} onClick={resetTerminal}>
            <Plus size={15} />
          </button>
          <button className="terminal-close" title={t("terminal.close")} onClick={() => togglePanel("terminal")}>
            <X size={16} />
          </button>
        </div>
        <div className="terminal-body" ref={terminalBodyRef}>
          {terminalEntries.length === 0 ? (
            <div className="terminal-empty">
              <Terminal size={16} />
              <span>{t("terminal.empty")}</span>
            </div>
          ) : (
            <div className="terminal-output-list">
              {terminalEntries.map((entry) => {
                const elapsed = formatElapsed((entry.finishedAt || statusNow) - entry.startedAt);
                const entryWorkspaceLabel = entry.cwd.split("/").filter(Boolean).slice(-1)[0] || getTerminalWorkspaceLabel();
                const entryPromptLabel = `(base) botbotbot@botbotmac ${entryWorkspaceLabel} %`;
                return (
                  <div className={`terminal-entry ${entry.status}`} key={entry.id}>
                    <div className="terminal-line">
                      <code className="terminal-prompt">{entryPromptLabel}</code>
                      <code className="terminal-command-text">{entry.command}</code>
                      <span className="terminal-command-status">
                        {entry.status === "running" ? t("terminal.running") : `exit ${entry.exitCode ?? 0}`} · {elapsed}
                      </span>
                    </div>
                    {entry.stdout ? <pre className="terminal-output">{entry.stdout}</pre> : null}
                    {entry.stderr ? <pre className="terminal-output stderr">{entry.stderr}</pre> : null}
                    {!entry.stdout && !entry.stderr && entry.status === "running" ? (
                      <div className="terminal-running-line">
                        <span className="terminal-cursor">▌</span>
                        <span>等待命令输出...</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          <form className="terminal-input-form" onSubmit={runTerminalCommand}>
            <code className="terminal-prompt">{promptLabel}</code>
            <input
              ref={terminalInputRef}
              className="terminal-input"
              value={terminalCommand}
              onChange={(event) => setTerminalCommand(event.target.value)}
              placeholder="输入 shell 命令，按 Enter 执行"
              spellCheck={false}
            />
            <button className="terminal-run-button" type="submit" disabled={!terminalCommand.trim() || terminalRunning} title="执行命令">
              {terminalRunning ? <Square size={14} /> : <Send size={14} />}
            </button>
          </form>
        </div>
      </section>
    );
  }

  function renderEdgeHotspots() {
    return (
      <>
        <button
          className="edge-hotspot terminal-hotspot"
          title={visiblePanels.terminal ? "收起 Terminal" : "展开 Terminal"}
          onClick={() => togglePanel("terminal")}
        >
          <Terminal size={18} />
        </button>
      </>
    );
  }

  const showMainSidebar = activeView !== "settings" && visiblePanels.sidebar;

  return (
    <main className={showMainSidebar ? "app-shell" : "app-shell sidebar-collapsed"}>
      {renderEdgeHotspots()}
      {showMainSidebar ? renderSidebar() : null}
      <section className={visiblePanels.terminal ? "content-shell" : "content-shell terminal-collapsed"}>
        {renderHeader()}
        {renderContent()}
        {visiblePanels.terminal ? renderTerminalPanel() : null}
      </section>
    </main>
  );
}
