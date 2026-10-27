import React, { useState } from 'react';
import { X, Terminal, Check, Copy, RefreshCw, Cpu, Server, ExternalLink, AlertCircle } from 'lucide-react';
import { fastApiClient, FASTAPI_PYTHON_CODE_TEMPLATE } from '../../services/fastapi';

interface FastApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange: (connected: boolean) => void;
}

export const FastApiModal: React.FC<FastApiModalProps> = ({
  isOpen,
  onClose,
  onConnectionChange
}) => {
  if (!isOpen) return null;

  const [baseUrl, setBaseUrl] = useState<string>(fastApiClient.getConfig().baseUrl);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(fastApiClient.getConfig().isLiveMode);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'main.py' | 'instructions'>('main.py');

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    fastApiClient.setBaseUrl(baseUrl);
    fastApiClient.setLiveMode(true);

    const result = await fastApiClient.checkHealth();
    setTesting(false);
    setTestResult(result);
    onConnectionChange(result.ok);
    setIsLiveMode(result.ok);
  };

  const handleToggleLiveMode = (enabled: boolean) => {
    setIsLiveMode(enabled);
    fastApiClient.setLiveMode(enabled);
    if (!enabled) {
      setTestResult({ ok: false, message: 'Đã chuyển về chế độ Demo Engine (Thuật toán Client)' });
      onConnectionChange(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(FASTAPI_PYTHON_CODE_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#090A0E]/85 backdrop-blur-md transition-opacity" 
      />

      {/* Modal Dialog Card (10px rounded per design system) */}
      <div className="relative w-full max-w-4xl bg-[#11141C] border border-white/[0.08] rounded-[10px] shadow-2xl overflow-hidden z-10 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#191D27] border border-[#E8B65B]/30 flex items-center justify-center text-[#E8B65B]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-[#F5F2EA]">
                  Cấu hình kết nối FastAPI Python
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-[#E8B65B]/15 text-[#E8B65B]">
                  VS Code Ready
                </span>
              </div>
              <p className="text-xs text-[#9EA3AE]">
                Kiến trúc sẵn sàng liên kết giữa React 19 Frontend và Backend Python Machine Learning
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-[8px] bg-[#191D27] text-[#9EA3AE] hover:text-[#F5F2EA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-[#9EA3AE]">
          {/* Connection Mode & URL Panel */}
          <div className="p-5 rounded-[8px] bg-[#191D27] border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-display font-semibold text-sm text-[#F5F2EA] flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#E8B65B]" />
                  Chế độ hoạt động (Backend Mode)
                </span>
                <p className="text-xs text-[#9EA3AE] mt-0.5">
                  Chọn giữa <strong>Demo Engine</strong> (chạy thuật toán client-side) hoặc <strong>Live FastAPI</strong> (gọi Python qua HTTP).
                </p>
              </div>

              {/* Mode Toggle Switch */}
              <div className="flex items-center gap-2 p-1 rounded-[8px] bg-[#11141C] border border-white/[0.08] self-start sm:self-auto">
                <button
                  onClick={() => handleToggleLiveMode(false)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
                    !isLiveMode
                      ? 'bg-[#E8B65B] text-[#090A0E] font-bold'
                      : 'text-[#9EA3AE] hover:text-[#F5F2EA]'
                  }`}
                >
                  Demo Mode
                </button>
                <button
                  onClick={() => handleToggleLiveMode(true)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
                    isLiveMode
                      ? 'bg-emerald-500 text-[#090A0E] font-bold'
                      : 'text-[#9EA3AE] hover:text-[#F5F2EA]'
                  }`}
                >
                  Live FastAPI
                </button>
              </div>
            </div>

            {/* Base URL Input & Ping button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full relative">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8000"
                  className="w-full bg-[#11141C] border border-white/[0.12] focus:border-[#E8B65B]/60 text-xs font-mono text-[#F5F2EA] rounded-[8px] px-3.5 py-2.5 focus:outline-none"
                />
              </div>

              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full sm:w-auto px-5 py-2.5 rounded-[8px] bg-[#E8B65B] hover:bg-[#F0C475] disabled:opacity-50 text-[#090A0E] font-display font-semibold text-xs tracking-wider uppercase whitespace-nowrap transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {testing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
              </button>
            </div>

            {/* Test result status feedback */}
            {testResult && (
              <div
                className={`p-3 rounded-[6px] text-xs flex items-center gap-2 ${
                  testResult.ok
                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-950/40 border border-amber-500/30 text-amber-300'
                }`}
              >
                {testResult.ok ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Quick Setup Instructions in VS Code */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveCodeTab('main.py')}
                  className={`text-xs font-medium pb-2 border-b-2 transition-colors ${
                    activeCodeTab === 'main.py'
                      ? 'border-[#E8B65B] text-[#F5F2EA]'
                      : 'border-transparent text-[#9EA3AE] hover:text-[#F5F2EA]'
                  }`}
                >
                  Mã nguồn Python (main.py)
                </button>
                <button
                  onClick={() => setActiveCodeTab('instructions')}
                  className={`text-xs font-medium pb-2 border-b-2 transition-colors ${
                    activeCodeTab === 'instructions'
                      ? 'border-[#E8B65B] text-[#F5F2EA]'
                      : 'border-transparent text-[#9EA3AE] hover:text-[#F5F2EA]'
                  }`}
                >
                  Hướng dẫn chạy trong VS Code
                </button>
              </div>

              {activeCodeTab === 'main.py' && (
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#191D27] hover:bg-white/10 text-xs font-medium text-[#F5F2EA] transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Đã sao chép!' : 'Sao chép mã'}</span>
                </button>
              )}
            </div>

            {activeCodeTab === 'main.py' ? (
              <div className="relative">
                <pre className="p-4 rounded-[8px] bg-[#090A0E] border border-white/[0.08] font-mono text-[11px] text-[#F5F2EA]/90 overflow-x-auto max-h-72 leading-relaxed">
                  <code>{FASTAPI_PYTHON_CODE_TEMPLATE}</code>
                </pre>
              </div>
            ) : (
              <div className="p-4 rounded-[8px] bg-[#191D27] border border-white/[0.08] space-y-3 text-xs leading-relaxed">
                <h4 className="font-semibold text-[#F5F2EA]">3 bước khởi chạy Backend Python:</h4>
                <ol className="space-y-2 list-decimal list-inside text-[#9EA3AE]">
                  <li>
                    Mở terminal trong VS Code và cài đặt các thư viện phụ thuộc:
                    <div className="p-2 mt-1 rounded bg-[#090A0E] font-mono text-[11px] text-[#E8B65B]">
                      pip install fastapi uvicorn pandas numpy scikit-learn
                    </div>
                  </li>
                  <li>
                    Tạo tệp <code className="text-[#F5F2EA]">main.py</code> và dán đoạn mã bên tab "Mã nguồn Python".
                  </li>
                  <li>
                    Khởi động server trên cổng 8000:
                    <div className="p-2 mt-1 rounded bg-[#090A0E] font-mono text-[11px] text-[#E8B65B]">
                      uvicorn main:app --reload --port 8000
                    </div>
                  </li>
                </ol>
                <p className="text-[11px] text-emerald-400 pt-1">
                  ✓ Sau khi server chạy, quay lại nhấn nút "Kiểm tra kết nối" ở trên để kích hoạt chế độ Live!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
