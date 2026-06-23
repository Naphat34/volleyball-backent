import React, { useState, useEffect } from 'react';
import { PDFDownloadLink, PDFViewer, BlobProvider } from '@react-pdf/renderer';
import O2FormDocument from './O2FormDocument'; // Import component ที่เราสร้างด้านบน
import { FileDown, Loader2, Eye, X, Printer } from 'lucide-react'; // เพิ่มไอคอน Printer

const O2FormLoader = ({ teamInfo, players = [], staff = [], myCompetitions = [] }) => {
    const [selectedCompId, setSelectedCompId] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    // Auto-select ถ้ามีรายการแข่งขันเดียว
    useEffect(() => {
        if (myCompetitions.length === 1 && !selectedCompId) {
            setSelectedCompId(myCompetitions[0].id.toString());
        }
    }, [myCompetitions, selectedCompId]);

    // คำนวณข้อมูลทีมที่จะแสดงใน PDF โดยใช้หลักการ Derived State
    const selectedComp = myCompetitions.find(c => c.id === parseInt(selectedCompId));

    const displayTeamInfo = {
        ...teamInfo,
        name: teamInfo?.name || '',
        code: teamInfo?.code || '',
        competition_name: selectedComp ? (selectedComp.title || selectedComp.name) : ''
    };

    // สร้าง unique key เพื่อบังคับให้ PDFDownloadLink สร้างไฟล์ใหม่เมื่อข้อมูลเปลี่ยน
    const pdfKey = `${selectedCompId}_${players.length}_${staff.length}_${JSON.stringify(teamInfo)}`;

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <FileDown className="text-red-600" /> Download O-2 Form
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                ระบบจะสร้างไฟล์ PDF ของใบ O-2 (TEAM REGISTRATION) โดยอัตโนมัติสำหรับทีม <strong>{teamInfo?.name}</strong>
            </p>

            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    เลือกรายการแข่งขัน (Competition)
                </label>
                <select
                    value={selectedCompId}
                    onChange={(e) => setSelectedCompId(e.target.value)}
                    className="w-full max-w-md px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 outline-none"
                >
                    <option value="">-- เลือกรายการแข่งขัน --</option>
                    {myCompetitions.map(comp => (
                        <option key={comp.id} value={comp.id}>
                            {comp.title || comp.name}
                        </option>
                    ))}
                </select>
                {!selectedCompId && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        * กรุณาเลือกรายการแข่งขันเพื่อระบุในใบ O-2
                    </p>
                )}
            </div>

            <div className="flex flex-wrap gap-3">
                {/* ส่วนประกอบที่ช่วยดาวน์โหลด PDF */}
                <PDFDownloadLink
                    key={`dl-${pdfKey}`}
                    document={<O2FormDocument teamInfo={displayTeamInfo} players={players} staff={staff} />}
                    fileName={`${displayTeamInfo.code || 'TEAM'}_O2_Form.pdf`}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg transition font-bold ${!selectedCompId
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-100 dark:shadow-none'
                        }`}
                >
                    {({ blob, url, loading, error }) => {
                        if (loading) return (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Generating PDF...
                            </>
                        );
                        if (!selectedCompId) return 'Download O-2';
                        return (
                            <>
                                <FileDown size={20} />
                                Download O-2
                            </>
                        );
                    }}
                </PDFDownloadLink>

                {/* ปุ่ม Preview */}
                <button
                    onClick={() => setShowPreview(true)}
                    disabled={!selectedCompId}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg transition font-bold ${!selectedCompId
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 dark:shadow-none'
                        }`}
                >
                    <Eye size={20} />
                    Preview O-2
                </button>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-10">
                    <div className="bg-white dark:bg-gray-800 w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                <Eye className="text-indigo-500" /> Preview O-2 Form
                            </h3>
                            <div className="flex items-center gap-3">
                                {/* ปุ่ม Print ภายใน Modal */}
                                <BlobProvider key={`print-${pdfKey}`} document={<O2FormDocument teamInfo={displayTeamInfo} players={players} staff={staff} />}>
                                    {({ url, loading }) => (
                                        <button
                                            onClick={() => {
                                                if (url) {
                                                    const printWindow = window.open(url, '_blank');
                                                    if (printWindow) {
                                                        printWindow.print();
                                                    }
                                                }
                                            }}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-sm shadow-md disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}
                                            Print O-2
                                        </button>
                                    )}
                                </BlobProvider>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <X size={24} className="text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <PDFViewer width="100%" height="100%" className="border-none shadow-inner">
                                <O2FormDocument teamInfo={displayTeamInfo} players={players} staff={staff} />
                            </PDFViewer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default O2FormLoader;