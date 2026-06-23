import React from 'react';

// --- Helper Component: แสดงโลโก้ + ชื่อทีม (ฉบับสมบูรณ์: ชื่อเต็มอยู่บน, ไม่ตัดคำ) ---
const TeamLogoDisplay = ({ logo, code, name, isRightAligned = false, textColor = '' }) => {
    // URL รูปภาพ (ปรับตาม Server ของคุณ)
    const BASE_URL = 'http://localhost:3000';

    const imageUrl = logo ? (logo.startsWith('http') ? logo : `${BASE_URL}${logo}`) : null;

    // กำหนดสีตัวอักษร
    const nameColorClass = textColor || "text-gray-800 dark:text-gray-200";

    const content = (
        <>
            {logo ? (
                <img
                    src={imageUrl}
                    alt={code}
                    className="w-12 h-12 object-contain shrink-0"
                    onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
                />
            ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-300 shrink-0">
                    {code ? code.substring(0, 2).toUpperCase() : '?'}
                </div>
            )}

            <div className={`flex flex-col justify-center ${isRightAligned ? 'items-end' : 'items-start'}`}>
                {/* ชื่อเต็ม (Name) - แสดงเต็ม ไม่ตัดคำ */}
                <span className={`font-bold text-sm md:text-base leading-tight ${nameColorClass}`}>
                    {name || code}
                </span>
                {/* รหัสทีม (Code) */}
                <span className="text-[10px] text-gray-400 font-mono tracking-wider">
                    {code}
                </span>
            </div>
        </>
    );

    return (
        <div className={`flex items-center gap-3 ${isRightAligned ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
            {content}
        </div>
    );
};

export default TeamLogoDisplay;
