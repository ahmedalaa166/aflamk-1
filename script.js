/* ==== نظام التفعيل والاشتراك (Firebase Version) ==== */

// وظيفة لتوليد ID فريد للجهاز
function getDeviceId() {
    let deviceId = localStorage.getItem('filmak_device_id');
    if (!deviceId) {
        deviceId = 'dev-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('filmak_device_id', deviceId);
    }
    return deviceId;
}

// التحقق من حالة الاشتراك عند فتح الموقع (من Firebase)
async function checkSubscription() {
    const savedCode = localStorage.getItem('filmak_active_code');
    const overlay = document.getElementById('login-overlay');
    
    if (!savedCode) {
        overlay.style.display = 'flex';
        return;
    }

    try {
        // البحث عن الكود في مجموعة "subscriptions" في Firestore
        const docRef = window.fbDoc(window.db, "subscriptions", savedCode);
        const docSnap = await window.fbGetDoc(docRef);

        if (docSnap.exists()) {
            const codeData = docSnap.data();
            const today = new Date();
            
            // تحويل التاريخ سواء كان نص أو Timestamp من Firebase
            let expiryDate;
            if (codeData.expiry && typeof codeData.expiry.toDate === 'function') {
                expiryDate = codeData.expiry.toDate();
            } else {
                expiryDate = new Date(codeData.expiry);
            }

            if (expiryDate >= today) {
                // الكود صالح
                overlay.style.display = 'none';
                return;
            }
        }
    } catch (error) {
        console.error("Firebase Auth Error:", error);
    }

    // إذا فشل أي شرط
    overlay.style.display = 'flex';
}

// وظيفة التحقق من الكود المدخل
window.validateCode = async function() {
    const codeInput = document.getElementById('activation-code').value.trim();
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');
    const deviceId = getDeviceId();

    if (!codeInput) {
        errorDiv.innerText = "برجاء إدخال الكود أولاً";
        return;
    }

    errorDiv.innerText = "";
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';

    try {
        // جلب البيانات من Firebase
        const docRef = window.fbDoc(window.db, "subscriptions", codeInput);
        const docSnap = await window.fbGetDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error("الكود غير صحيح أو غير موجود");
        }

        const codeData = docSnap.data();
        const today = new Date();
        
        // تحويل التاريخ سواء كان نص أو Timestamp من Firebase
        let expiryDate;
        if (codeData.expiry && typeof codeData.expiry.toDate === 'function') {
            expiryDate = codeData.expiry.toDate();
        } else {
            expiryDate = new Date(codeData.expiry);
        }

        if (expiryDate < today) {
            throw new Error("عذراً، هذا الكود انتهت صلاحيته");
        }

        // التحقق من قائمة الأجهزة (الحد الأقصى هو 6 أو القيمة الموجودة في Firebase)
        const maxAllowed = codeData.maxDevices || 6; 
        const deviceList = codeData.devices || [];

        // استثناء خاص لكود الـ Admin
        const isAdmin = (codeInput === 'admin123');

        if (!deviceList.includes(deviceId)) {
            if (!isAdmin && deviceList.length >= maxAllowed) {
                throw new Error("لقد وصلت للحد الأقصى من الأجهزة (6 أجهزة)");
            }
            
            // إضافة الجهاز الجديد لـ Firebase وتحديث وقت الدخول
            await window.fbUpdateDoc(docRef, {
                devices: window.fbArrayUnion(deviceId),
                lastLogin: new Date().toLocaleString('ar-EG'),
                lastDevice: navigator.userAgent.split(')')[0].split('(')[1] || "جهاز غير معروف"
            });
        } else {
            // تحديث وقت الدخول فقط لو الجهاز مسجل مسبقاً
            await window.fbUpdateDoc(docRef, {
                lastLogin: new Date().toLocaleString('ar-EG')
            });
        }

        // نجاح العملية
        localStorage.setItem('filmak_active_code', codeInput);
        document.getElementById('login-overlay').style.display = 'none';

    } catch (error) {
        errorDiv.innerText = error.message || "حدث خطأ في النظام";
        btn.disabled = false;
        btn.innerHTML = '<span>دخول للمنصة</span> <i class="fas fa-sign-in-alt"></i>';
    }
};

// وظيفة المراقب الصامت (للخلفية فقط)
async function silentMonitor() {
    const savedCode = localStorage.getItem('filmak_active_code');
    if (!savedCode) return;

    try {
        const docRef = window.fbDoc(window.db, "subscriptions", savedCode);
        const docSnap = await window.fbGetDoc(docRef);
        if (docSnap.exists()) {
            const codeData = docSnap.data();
            const today = new Date();
            let expiryDate;
            if (codeData.expiry && typeof codeData.expiry.toDate === 'function') {
                expiryDate = codeData.expiry.toDate();
            } else {
                expiryDate = new Date(codeData.expiry);
            }

            if (expiryDate < today) {
                // انتهى الوقت! اطرد العميل
                localStorage.removeItem('filmak_active_code');
                document.getElementById('login-overlay').style.display = 'flex';
            }
        } else {
            // الكود اتمسح من الـ Database! اطرد العميل
            localStorage.removeItem('filmak_active_code');
            document.getElementById('login-overlay').style.display = 'flex';
        }
    } catch (e) {
        // فشل الاتصال، لا تفعل شيء وانتظر المرة القادمة
    }
}

// تشغيل التحقق عند التحميل
document.addEventListener('DOMContentLoaded', checkSubscription);

// المراقب الصامت يشتغل كل دقيقتين في الخلفية
setInterval(silentMonitor, 120000); 

// وظيفة مساعدة للتحقق السريع قبل المشاهدة
async function isSubscriptionValid() {
    const savedCode = localStorage.getItem('filmak_active_code');
    if (!savedCode) return false;

    try {
        const docRef = window.fbDoc(window.db, "subscriptions", savedCode);
        const docSnap = await window.fbGetDoc(docRef);
        if (docSnap.exists()) {
            const codeData = docSnap.data();
            const today = new Date();
            
            let expiryDate;
            if (codeData.expiry && typeof codeData.expiry.toDate === 'function') {
                expiryDate = codeData.expiry.toDate();
            } else {
                expiryDate = new Date(codeData.expiry);
            }

            if (expiryDate >= today) return true;
        }
    } catch (e) {
        console.error("Auth verify error");
    }
    
    // لو منتهي أو مش موجود، نمسح الكود ونظهر شاشة الدخول
    localStorage.removeItem('filmak_active_code');
    document.getElementById('login-overlay').style.display = 'flex';
    return false;
}

// Master Data Collection - Latest Additions should be at the TOP of this array
const allContent = [
    {
        id: 's-karitha-tabiiya',
        title: 'مسلسل كارثة طبيعية',
        type: 'series',
        category: 'arabic-series',
        poster: 'صور/karitha_tabiiya.jpg',
        year: '29 اكتوبر 2025',
        quality: 'FHD',
        desc: 'تدور أحداث كارثة طبيعية حول شاب من أسرة بسيطة، متزوج حديثًا، يكافح لبناء حياته من الصفر وسط تحديات وضغوط يومية. ويفاجأ بحمل زوجته في خمس توائم، وفيسعى رغم الظروف الاقتصادية القاسية لتأمين حياة كريمة لعائلته.',
        hideSeasonText: true,
        seasons: [
            {
                seasonNumber: 1,
                episodes: [
                    {
                        id: 's-karitha-ep1',
                        title: 'الحلقة 1',
                        videoUrl: 'https://anafasts.com/embed-opr6ueqhvpu0.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/4mpcj8wyouy4.html',
                            high: 'https://vik1ngfile.site/f/alv7R0fsSN'
                        }
                    },
                    {
                        id: 's-karitha-ep2',
                        title: 'الحلقة 2',
                        videoUrl: 'https://anafasts.com/embed-epm7th80xvt4.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/bp5txqxv2nx8.html',
                            high: 'https://vik1ngfile.site/f/IAnjgi6ebL'
                        }
                    },
                    {
                        id: 's-karitha-ep3',
                        title: 'الحلقة 3',
                        videoUrl: 'https://anafast.org/embed-54e8g3643tzk.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/m95de7896iop.html',
                            high: 'https://vik1ngfile.site/f/WKGcVZrIuG'
                        }
                    },
                    {
                        id: 's-karitha-ep4',
                        title: 'الحلقة 4',
                        videoUrl: 'https://anafast.org/embed-80q8qau0clug.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/jal1splq2344.html',
                            high: 'https://vik1ngfile.site/f/1cUrPYATvI'
                        }
                    },
                    {
                        id: 's-karitha-ep5',
                        title: 'الحلقة 5',
                        videoUrl: 'https://anafast.org/embed-yc2idq6ppsdw.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/3qsvyfzv8fpq.html',
                            high: 'https://vik1ngfile.site/f/NBBfyenL5r'
                        }
                    },
                    {
                        id: 's-karitha-ep6',
                        title: 'الحلقة 6',
                        videoUrl: 'https://anafast.org/embed-086vr2j47bu4.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/rpon0bmn9e1u.html',
                            high: 'https://vik1ngfile.site/f/paeVQp1JUv'
                        }
                    },
                    {
                        id: 's-karitha-ep7',
                        title: 'الحلقة 7',
                        videoUrl: 'https://anafast.org/embed-961h87nigrss.html',
                        downloads: {
                            medium: 'https://anafast.org/d/961h87nigrss.html',
                            high: 'https://vik1ngfile.site/f/hmrBEhcKd3'
                        }
                    },
                    {
                        id: 's-karitha-ep8',
                        title: 'الحلقة 8',
                        videoUrl: 'https://anafast.org/embed-v5i862464rmo.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/y1h3rz4c72ba.html',
                            high: 'https://vik1ngfile.site/f/0k3FWXzqJH'
                        }
                    },
                    {
                        id: 's-karitha-ep9',
                        title: 'الحلقة 9',
                        videoUrl: 'https://anafast.org/embed-0ghcyfong44f.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/3v9othtafhm9.html',
                            high: 'https://vik1ngfile.site/f/UeEBEsx5cZ'
                        }
                    },
                    {
                        id: 's-karitha-ep10',
                        title: 'الحلقة 10 والأخيرة',
                        videoUrl: 'https://anafast.org/embed-dso9b9g1ws1p.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/ko6rjsqw9359.html',
                            high: 'https://vik1ngfile.site/f/iy9nZQ7eQz'
                        }
                    }
                ]
            }
        ]
    },
    {
        id: 's-batal-al-alam',
        title: 'مسلسل بطل العالم',
        type: 'series',
        category: 'arabic-series',
        poster: 'صور/batal_al_alam.jpg',
        year: '18 يناير 2026',
        quality: 'FHD',
        desc: 'بعد خسارة بطولة العالم، يتحول بطل أفريقيا في الملاكمة إلى حارس شخصي محترف يبحث عن فرصة ثانية. تتغير حياته تماماً حين يُكلَّف بحماية دنيا، ابنة رجل أعمال ماكر ترك وراءه ميراثاً مخفياً وديوناً خطيرة لمحروق، ملك عالم الرهانات. ينطلق صلاح ودنيا في مطاردات مشتعلة لكشف سر الثروة، وخلال الرحلة يستعيد البطل قوته ويجد طريقاً جديداً نحو الحب والخلاص.',
        hideSeasonText: true,
        seasons: [
            {
                seasonNumber: 1,
                episodes: [
                    {
                        id: 's-batal-ep1',
                        title: 'الحلقة 1',
                        videoUrl: 'https://anafast.org/embed-fcu0f8yih2ll.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/mucvyibx9p8w.html',
                            high: 'https://vik1ngfile.site/f/FxrF84Fn8H'
                        }
                    },
                    {
                        id: 's-batal-ep2',
                        title: 'الحلقة 2',
                        videoUrl: 'https://anafast.org/embed-t2f13of9jqla.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/wvyujwjzue35.html',
                            high: 'https://vik1ngfile.site/f/ZUKPgcsPBb'
                        }
                    },
                    {
                        id: 's-batal-ep3',
                        title: 'الحلقة 3',
                        videoUrl: 'https://anafast.org/embed-3s3ss5l834fd.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/zog2p3cceojk.html',
                            high: 'https://vik1ngfile.site/f/wXWxn9OPYw'
                        }
                    },
                    {
                        id: 's-batal-ep4',
                        title: 'الحلقة 4',
                        videoUrl: 'https://anafast.org/embed-8lcxgk0n8eob.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/4rszb85qnyuk.html',
                            high: 'https://vik1ngfile.site/f/BgijYZkyZv'
                        }
                    },
                    {
                        id: 's-batal-ep5',
                        title: 'الحلقة 5',
                        videoUrl: 'https://vidspeed.org/embed-it7o2r1ygwc5.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/it7o2r1ygwc5.html',
                            high: 'https://vik1ngfile.site/f/bCS5oL2bk6'
                        }
                    },
                    {
                        id: 's-batal-ep6',
                        title: 'الحلقة 6',
                        videoUrl: 'https://anafast.org/embed-vvkx6hf7bvmb.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/6z6qyegxyv79.html',
                            high: 'https://vik1ngfile.site/f/Se2txm2Jgi'
                        }
                    },
                    {
                        id: 's-batal-ep7',
                        title: 'الحلقة 7',
                        videoUrl: 'https://anafast.org/embed-gyrxks8kbe2u.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/a5g1vku7in02.html',
                            high: 'https://vik1ngfile.site/f/hMyWNsyJ1G'
                        }
                    },
                    {
                        id: 's-batal-ep8',
                        title: 'الحلقة 8',
                        videoUrl: 'https://anafast.org/embed-w4z5opcmctza.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/zbkth2gbxqnj.html',
                            high: 'https://vik1ngfile.site/f/uFoZfMD8vJ'
                        }
                    },
                    {
                        id: 's-batal-ep9',
                        title: 'الحلقة 9',
                        videoUrl: 'https://vidspeed.org/embed-vwjvrq8t1fez.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/vwjvrq8t1fez.html',
                            high: 'https://vik1ngfile.site/f/VeKCwQyN6d'
                        }
                    },
                    {
                        id: 's-batal-ep10',
                        title: 'الحلقة 10 والأخيرة',
                        videoUrl: 'https://anafast.org/embed-eg8tlnupg9ql.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/fb8jld1xs3wt.html',
                            high: 'https://vik1ngfile.site/f/iZZ4VSgyPq'
                        }
                    }
                ]
            }
        ]
    },
    {
        id: 'live-rotana-comedy',
        title: 'قناة روتانا كوميدي',
        type: 'live',
        category: 'live',
        poster: 'صور/rotana_comedy.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة روتانا كوميدي، القناة المتخصصة في عرض أقوى الأفلام والبرامج الكوميدية العربية الكلاسيكية والحديثة لرسم البسمة على وجوهكم.',
        videoUrl: 'https://tv.qanwatlive.com/2025/03/blog-post_25.html',
        subCategory: 'movies'
    },
    {
        id: 'live-rotana-drama',
        title: 'قناة روتانا دراما',
        type: 'live',
        category: 'live',
        poster: 'صور/rotana_drama.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة روتانا دراما، القناة الرائدة في عرض أقوى المسلسلات العربية والدرامية المصرية والخليجية والتركية المدبلجة على مدار الساعة.',
        videoUrl: 'https://tv.qanwatlive.com/2025/03/blog-post_80.html',
        subCategory: 'variety'
    },
    {
        id: 's-heya-kemya',
        title: 'هي كيميا؟!',
        type: 'series',
        category: 'arabic-series',
        poster: 'صور/heya_kemya.jpg',
        year: '18 فبراير 2026',
        quality: 'FHD',
        desc: 'تنهار حياة سلطان المستقرة حين تظهر فيها معادلة غير عادية تبدأ بوفاة والده. تتحول الجنازة إلى نقطة تحول كبرى حين يظهر حجاج، وهو أخوه الذي يظهر لأول مرة في حياته، ولم يسمع عنه سلطان من قبل.',
        seasons: [
            {
                seasonNumber: 1,
                episodes: [
                    {
                        id: 'ep1-1',
                        title: 'الحلقة 1',
                        videoUrl: 'https://vfaststream.co/e/DFleW7wsSXpO',
                        downloads: {
                            medium: 'https://vidspeed.org/d/grcejlipkkhd.html',
                            high: 'https://vik1ngfile.site/f/qwoVK2nh9N'
                        }
                    },
                    {
                        id: 'ep1-2',
                        title: 'الحلقة 2',
                        videoUrl: 'https://vfaststream.co/e/TOwQzo7xxwOA',
                        downloads: {
                            medium: 'https://vidspeed.org/d/cvqdcezqa8lv.html',
                            high: 'https://vik1ngfile.site/f/5dMm0Rk8f0'
                        }
                    },
                    {
                        id: 'ep1-3',
                        title: 'الحلقة 3',
                        videoUrl: 'https://vfaststream.co/e/4BrkrfOgYKRK',
                        downloads: {
                            medium: 'https://vidspeed.org/d/d80k2qxjdzw9.html',
                            high: 'https://vik1ngfile.site/f/IwBAY2W9Jn'
                        }
                    },
                    {
                        id: 'ep1-4',
                        title: 'الحلقة 4',
                        videoUrl: 'https://vfaststream.co/e/4BrkrfOgYKRK',
                        downloads: {
                            medium: 'https://vidspeed.org/d/d80k2qxjdzw9.html',
                            high: 'https://vik1ngfile.site/f/IwBAY2W9Jn'
                        }
                    },
                    {
                        id: 'ep1-5',
                        title: 'الحلقة 5',
                        videoUrl: 'https://vfaststream.co/e/RBz4BxVXpvmO',
                        downloads: {
                            medium: 'https://vidspeed.org/d/r9smusvnkzni.html',
                            high: 'https://vik1ngfile.site/f/pomjJvElql'
                        }
                    },
                    {
                        id: 'ep1-6',
                        title: 'الحلقة 6',
                        videoUrl: 'https://vfaststream.co/e/tuT9lFlUYxKR',
                        downloads: {
                            medium: 'https://vidspeed.org/d/o3ok3zvbup7h.html',
                            high: 'https://vik1ngfile.site/f/5KaiTLMOOO'
                        }
                    },
                    {
                        id: 'ep1-7',
                        title: 'الحلقة 7',
                        videoUrl: 'https://vfaststream.co/e/hg2zAJ8aJr5u',
                        downloads: {
                            medium: 'https://q9rin5rc85p0.html',
                            high: 'https://vik1ngfile.site/f/W12iTejl0V'
                        }
                    },
                    {
                        id: 'ep1-8',
                        title: 'الحلقة 8',
                        videoUrl: 'https://vfaststream.co/e/yJSTC3zLIzZr',
                        downloads: {
                            medium: 'https://vidspeed.org/d/wzaqurilnf4a.html',
                            high: 'https://vik1ngfile.site/f/WPsN8mhjhV'
                        }
                    },
                    {
                        id: 'ep1-9',
                        title: 'الحلقة 9',
                        videoUrl: 'https://vfaststream.co/e/53z1UxWefSKV',
                        downloads: {
                            medium: 'https://vidspeed.org/d/aodge112oglo.html',
                            high: 'https://vik1ngfile.site/f/6rLq4XRy5K'
                        }
                    },
                    {
                        id: 'ep1-10',
                        title: 'الحلقة 10',
                        videoUrl: 'https://vfaststream.co/e/GPtfvX954d0o',
                        downloads: {
                            medium: 'https://vidspeed.org/d/m3seyguy6sw2.html',
                            high: 'https://vik1ngfile.site/f/MD1XevOnWQ'
                        }
                    },
                    {
                        id: 'ep1-11',
                        title: 'الحلقة 11',
                        videoUrl: 'https://vfaststream.co/e/IhD9z4Pbhvkm',
                        downloads: {
                            medium: 'https://vidspeed.org/d/wkccjxeet5pw.html',
                            high: 'https://vik1ngfile.site/f/zFIMPW202a'
                        }
                    },
                    {
                        id: 'ep1-12',
                        title: 'الحلقة 12',
                        videoUrl: 'https://vfaststream.co/e/Vy5raVNa9qcA',
                        downloads: {
                            medium: 'https://vidspeed.org/d/jvpyhs1w3gon.html',
                            high: 'https://vik1ngfile.site/f/GQjYc3sZNT'
                        }
                    },
                    {
                        id: 'ep1-13',
                        title: 'الحلقة 13',
                        videoUrl: 'https://vfaststream.co/e/Njw5TsP2yLuE',
                        downloads: {
                            medium: 'https://vidspeed.org/d/3aghiutlhoqm.html',
                            high: 'https://vik1ngfile.site/f/9tm3c0Bwgx'
                        }
                    },
                    {
                        id: 'ep1-14',
                        title: 'الحلقة 14',
                        videoUrl: 'https://vfaststream.co/e/whujiYNmxpRA',
                        downloads: {
                            medium: 'https://vidspeed.org/d/y7kvkj2xjj9c.html',
                            high: 'https://vik1ngfile.site/f/KplIK6m6Ws'
                        }
                    },
                    {
                        id: 'ep1-15',
                        title: 'الحلقة 15',
                        videoUrl: 'https://vfaststream.co/e/ZPz06LpTTIXj',
                        downloads: {
                            medium: 'https://vidspeed.org/d/8omcdh3u5ial.html',
                            high: 'https://vik1ngfile.site/f/I9wfNWjaaL'
                        }
                    }
                ]
            }
        ]
    },
    {
        id: 'm-thrash',
        title: 'Thrash',
        type: 'movie',
        category: 'foreign-movie',
        poster: 'صور/thrash.jpg',
        year: '10 ابريل 2026',
        quality: 'FHD',
        desc: 'يتبع العمل قصة مدينة ساحلية تتعرض لإعصار من الفئة الخامسة، حيث يجلب ارتفاع الأمواج دمارًا وفوضى، وما هو أخطر من ذلك: أسماك قرش جائعة تهدد كل من ينجو من العاصفة.',
        videoUrl: 'https://anafast.org/embed-kz82abluj52r.html',
        downloads: {
            medium: 'https://www.up-4ever.net/kdkoqx3dtvu7',
            high: 'https://www.up-4ever.net/2njuzovbyas8'
        }
    },
    {
        id: 'm-sico-sico',
        title: 'سيكو سيكو',
        type: 'movie',
        category: 'arabic-movie',
        poster: 'صور/sico_sico.jpg',
        year: '30 مارس 2025',
        quality: 'FHD',
        desc: 'يحصل (سليم) وابن عمه (يحيى) على ميراث عمهما المتوفي، ثم يكتشفان أن الميراث عبارة عن شحنة مخدرات، فيحاولان التصرف فيها وبيعها من خلال ابتكار لعبة إلكترونية وبمساعدة مجموعة من الأشخاص، لكن تنقلب حياتهما رأسًا على عقب بعد ظهور زعيم عصابة خطير يدّعي أنه المالك الحقيقي للسلع.',
        videoUrl: 'https://short.icu/WyaHO_Bl6',
        downloads: {
            medium: 'https://updown.cam/c16pkhdujcja',
            high: 'https://updown.cam/v75plz968nwk'
        }
    },
    {
        id: 'm-ahmed-wa-ahmed',
        title: 'أحمد وأحمد',
        type: 'movie',
        category: 'arabic-movie',
        poster: 'صور/ahmed_wa_ahmed.jpg',
        year: '2 يوليو 2025',
        quality: 'FHD',
        desc: 'يقرر (أحمد) العودة إلى مصر وطلب يد (ضحى) للزواج، ولكن سريعًا تتعطل خططه حينما يُصاب خاله (أحمد) في حادث غامض ويفقد الذاكرة، ويكتشف سر خاله الصادم بزعامته لإمبراطورية إجرامية خطيرة.',
        videoUrl: 'https://vfaststream.co/e/LC1U9OY2PzGb',
        downloads: {
            medium: 'https://vidspeed.org/d/1tqdn5xx7x0q.html',
            high: 'https://vik1ngfile.site/f/gOHebq711p'
        }
    },
    {
        id: 's-alleba',
        title: 'اللعبة 5: الكلاسيكو',
        type: 'series',
        category: 'arabic-series',
        poster: 'صور/al_leba_s5.jpg',
        year: '12 ابريل 2026',
        quality: 'FHD',
        desc: 'تستمر في الموسم الخامس مغامرات وسيم ومازو، حيث يعاني وسيم من ضائقة مالية ويحاول الجميع مساعدته، وعلى جانب آخر يعيش مازو في رفاهية بعد الاستحواذ على الأموال، إلى أن تفرض عليهم اللعبة تحديات جديدة تعتمد على الذكاء الاصطناعي، وتتوالى الأحداث.',
        seasons: [
            {
                seasonNumber: 5,
                episodes: [
                    {
                        id: 's5-ep1',
                        title: 'الحلقة 1',
                        videoUrl: 'https://vidara.to/e/150MEgMR7YinL',
                        downloads: {
                            medium: 'https://www.up-4ever.net/sx47c4k1wxa6',
                            high: 'https://www.up-4ever.net/njtfjtlzbb6k'
                        }
                    },
                    {
                        id: 's5-ep2',
                        title: 'الحلقة 2',
                        videoUrl: 'https://vfaststream.co/e/2vb4N4lcTVXBU',
                        downloads: {
                            medium: 'https://vidspeed.org/d/vcjrqa2kkwr4.html',
                            high: 'https://vik1ngfile.site/f/ljTStYhpSE'
                        }
                    }
                ]
            }
        ]
    },
    {
        id: 's-ein-sehreya',
        title: 'مسلسل عين سحرية',
        type: 'series',
        category: 'arabic-series',
        poster: 'صور/ein_sehreya.jpg',
        year: '19 فبراير 2026',
        quality: 'Full HD',
        desc: 'عادل شاب بسيط يمتلك موهبة في تركيب كاميرات المراقبة. وتحت ضغط الظروف المادية، يوافق على زرع كاميرات بشكل سري مقابل المال، قبل أن يشهد بالصدفة جريمة قتل. محاولته إخفاء ما رآه تجرّه إلى شبكة خطيرة يقودها المحامي الفاسد زكي غانم ومافيا دوائية نافذة. ومع تهديد عائلته، يُجبر عادل على خوض رحلة محفوفة بالمخاطر لكشف الفساد.',
        hideSeasonText: true,
        seasons: [
            {
                seasonNumber: 1,
                episodes: [
                    {
                        id: 'ep1-1',
                        title: 'الحلقة 1',
                        videoUrl: 'https://vidara.to/e/J4lzP1DYmpG34',
                        downloads: {
                            medium: 'https://filespayouts.com/mspp5otd8y2e/%5Barabseed%5D.Ein.Sehreya.S01.E01.480p.mp4',
                            high: 'https://filespayouts.com/r6fw4vcshl86/%5Barabseed%5D.Ein.Sehreya.S01.E01.720p.mp4'
                        }
                    },
                    {
                        id: 'ep1-2',
                        title: 'الحلقة 2',
                        videoUrl: 'https://vidara.to/e/r9mpHunZVQN7x',
                        downloads: {
                            medium: 'https://filespayouts.com/hsryjc135r8y/%5Barabseed%5D.Ein.Sehreya.S01.E02.480p.mp4',
                            high: 'https://filespayouts.com/blth0hc3xd0k/%5Barabseed%5D.Ein.Sehreya.S01.E02.720p.mp4'
                        }
                    },
                    {
                        id: 'ep1-3',
                        title: 'الحلقة 3',
                        videoUrl: 'https://vfaststream.co/e/2hm77cpuKoTY',
                        downloads: {
                            medium: 'https://filespayouts.com/dpb4tn6jx63e/%5Barabseed%5D.Ein.Sehreya.S01.E03.480p.mp4',
                            high: 'https://filespayouts.com/pj5azi57nmii/%5Barabseed%5D.Ein.Sehreya.S01.E03.720p.mp4'
                        }
                    },
                    {
                        id: 'ep1-4',
                        title: 'الحلقة 4',
                        videoUrl: 'https://vfaststream.co/e/XmgX7vDK21yU',
                        downloads: {
                            medium: 'https://vidspeed.org/d/94iolcjfjaow.html',
                            high: 'https://vik1ngfile.site/f/1HAkkAjy6Y'
                        }
                    },
                    {
                        id: 'ep1-5',
                        title: 'الحلقة 5',
                        videoUrl: 'https://vfaststream.co/e/TARgLvDBIoyA',
                        downloads: {
                            medium: 'https://vidspeed.org/d/bl9o50ekrmmy.html',
                            high: 'https://vik1ngfile.site/f/MJ3J3ezReG'
                        }
                    },
                    {
                        id: 'ep1-6',
                        title: 'الحلقة 6',
                        videoUrl: 'https://anafast.org/embed-d9rqu3ybop5c.html',
                        downloads: {
                            medium: 'https://vidspeed.org/d/oha42qrvys1c.html',
                            high: 'https://vik1ngfile.site/f/vKvQ3XKim2'
                        }
                    },
                    {
                        id: 'ep1-7',
                        title: 'الحلقة 7',
                        videoUrl: 'https://vfaststream.co/e/hDaUCN6t8e9r',
                        downloads: {
                            medium: 'https://vidspeed.org/d/48rt4c8j2joe.html',
                            high: 'https://vik1ngfile.site/f/c6jpAuAHsv'
                        }
                    },
                    {
                        id: 'ep1-8',
                        title: 'الحلقة 8',
                        videoUrl: 'https://vfaststream.co/e/5QVq0kXt09UD',
                        downloads: {
                            medium: 'https://vidspeed.org/d/0keagm8nndr0.html',
                            high: 'https://vik1ngfile.site/f/cwbZKGmlIs'
                        }
                    },
                    {
                        id: 'ep1-9',
                        title: 'الحلقة 9',
                        videoUrl: 'https://vfaststream.co/e/jedmRZdet7zY',
                        downloads: {
                            medium: 'https://vidspeed.org/d/ly5tg6le4l72.html',
                            high: 'https://vik1ngfile.site/f/LSDlEE5mGl'
                        }
                    },
                    {
                        id: 'ep1-10',
                        title: 'الحلقة 10',
                        videoUrl: 'https://vfaststream.co/e/GXp8FJuucbyc',
                        downloads: {
                            medium: 'https://vidspeed.org/d/8vgho4acqo6v.html',
                            high: 'https://vik1ngfile.site/f/3QjEZrFmFh'
                        }
                    },
                    {
                        id: 'ep1-11',
                        title: 'الحلقة 11',
                        videoUrl: 'https://vfaststream.co/e/3KiLj4M96bKn',
                        downloads: {
                            medium: 'https://vidspeed.org/d/2gimdtm0y67z.html',
                            high: 'https://vik1ngfile.site/f/MxH4KnlVOZ'
                        }
                    },
                    {
                        id: 'ep1-12',
                        title: 'الحلقة 12',
                        videoUrl: 'https://vfaststream.co/e/qz8OFaDYUkvU',
                        downloads: {
                            medium: 'https://vidspeed.org/d/tujfwzb1ksk4.html',
                            high: 'https://vik1ngfile.site/f/IejUfzpBBH'
                        }
                    },
                    {
                        id: 'ep1-13',
                        title: 'الحلقة 13',
                        videoUrl: 'https://vfaststream.co/e/FTcRns4dKAqh',
                        downloads: {
                            medium: 'https://vidspeed.org/d/2g4357451r6k.html',
                            high: 'https://vik1ngfile.site/f/C9dzO7zmH3'
                        }
                    },
                    {
                        id: 'ep1-14',
                        title: 'الحلقة 14',
                        videoUrl: 'https://vfaststream.co/e/6OI6uFNxWVLW',
                        downloads: {
                            medium: 'https://vidspeed.org/d/setbt553zjy4.html',
                            high: 'https://vik1ngfile.site/f/EbhlvfvDTz'
                        }
                    },
                    {
                        id: 'ep1-15',
                        title: 'الحلقة 15',
                        videoUrl: 'https://vfaststream.co/e/FRY1YSlDjSPX',
                        downloads: {
                            medium: 'https://vidspeed.org/d/25oao5ki34zk.html',
                            high: 'https://vik1ngfile.site/f/S3DmtwgcU9'
                        }
                    }
                ]
            }
        ]
    },
    {
        id: 'live-mbc3',
        title: 'قناة MBC 3',
        type: 'live',
        category: 'live',
        poster: 'صور/mbc3.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة MBC 3 بجودة عالية، القناة الرائدة في تقديم أروع أفلام الكرتون والبرامج الترفيهية والتعليمية الهادفة للأطفال والناشئين في العالم العربي.',
        videoUrl: 'https://live.aflam4you.net/embed.php?vid=17',
        subCategory: 'kids'
    },
    {
        id: 'live-onsport',
        title: 'قناة ON Sport',
        type: 'live',
        category: 'live',
        poster: 'صور/onsport.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة ON Sport بجودة عالية، القناة الرياضية المصرية الرائدة في نقل مباريات الدوري المصري وأقوى الاستوديوهات التحليلية والبرامج الرياضية.',
        videoUrl: 'https://live.aflam4you.net/embed.php?vid=445',
        subCategory: 'sports'
    },
    {
        id: 'live-bein3',
        title: 'قناة beIN SPORTS 3',
        type: 'live',
        category: 'live',
        poster: 'صور/bein3.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة beIN SPORTS 3 بجودة عالية، الاستمتاع بتغطية حصرية وشاملة لأهم المباريات والبطولات الرياضية حول العالم.',
        videoUrl: 'https://live.aflam4you.net/embed.php?vid=1',
        subCategory: 'sports'
    },
    {
        id: 'live-bein2',
        title: 'قناة beIN SPORTS 2',
        type: 'live',
        category: 'live',
        poster: 'صور/bein2.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة beIN SPORTS 2 بجودة عالية، لتغطية حصرية ومباشرة لأهم المباريات والبطولات الرياضية العالمية على مدار الساعة.',
        videoUrl: 'https://live.aflam4you.net/embed.php?vid=2',
        subCategory: 'sports'
    },
    {
        id: 'live-bein1',
        title: 'قناة beIN SPORTS 1',
        type: 'live',
        category: 'live',
        poster: 'صور/bein1.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة beIN SPORTS 1 بجودة عالية، القناة الرياضية الأولى لتغطية أقوى البطولات العالمية والمباريات المباشرة لحظة بلحظة.',
        videoUrl: 'https://live.aflam4you.net/embed.php?vid=68',
        subCategory: 'sports'
    },
    {
        id: 'live-mbcaction',
        title: 'قناة MBC ACTION',
        type: 'live',
        category: 'live',
        poster: 'صور/mbcaction.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة MBC ACTION بجودة عالية، القناة المفضلة لعشاق الأكشن، الإثارة، والسرعة، مع أحدث البرامج الرياضية ومباريات المصارعة والأفلام العالمية.',
        videoUrl: 'https://tv.qanwatlive.com/2025/03/blog-post_33.html',
        subCategory: 'movies'
    },
    {
        id: 'live-mbcmax',
        title: 'قناة MBC MAX',
        type: 'live',
        category: 'live',
        poster: 'صور/mbcmax.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة MBC MAX بجودة عالية، القناة الرائدة في تقديم أرقى الأفلام الكوميدية والرومانسية والدرامية من هوليوود على مدار الساعة.',
        videoUrl: 'https://tv.qanwatlive.com/2025/03/blog-post_0.html',
        subCategory: 'movies'
    },
    {
        id: 'live-alnahar',
        title: 'قناة النهار',
        type: 'live',
        category: 'live',
        poster: 'صور/alnahar.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة النهار بجودة عالية، واحدة من أبرز القنوات المصرية التي تقدم محتوى متنوعاً يشمل البرامج الحوارية، المسلسلات، والبرامج الترفيهية.',
        videoUrl: 'https://tv.qanwatlive.com/2025/06/blog-post_78.html',
        subCategory: 'variety'
    },
    {
        id: 'live-mbc-masr',
        title: 'قناة MBC مصر',
        type: 'live',
        category: 'live',
        poster: 'صور/mbc_masr.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة MBC مصر بجودة عالية، القناة الرائدة في تقديم البرامج الترفيهية والمسلسلات والبرامج الحوارية في مصر والوطن العربي.',
        videoUrl: 'https://play.tlfaz.com/player/#https://shd-gcp-live.lg.mncdn.com/live/bitmovin-mbc-masr/956eac069c78a35d47245db6cdbb1575/index.m3u8',
        subCategory: 'variety'
    },
    {
        id: 'live-spacetoon',
        title: 'قناة سبيستون',
        type: 'live',
        category: 'live',
        poster: 'صور/spacetoon.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة سبيستون (Spacetoon) بجودة عالية، قناة شباب المستقبل التي تربى عليها أجيال، لمتابعة أروع مسلسلات الكرتون والأنمي المدبلج.',
        videoUrl: 'https://play.tlfaz.com/player/#https://shd-gcp-live.edgenextcdn.net/live/bitmovin-spacetoon/d8382fb9ab4b2307058f12c7ea90db54/index.m3u8',
        subCategory: 'kids'
    },
    {
        id: 'live-mbc-masr-2',
        title: 'قناة MBC مصر 2',
        type: 'live',
        category: 'live',
        poster: 'صور/mbc_masr2.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة MBC مصر 2 بجودة عالية، القناة المتميزة في عرض البرامج الرياضية والترفيهية والمسلسلات الحصرية للجمهور المصري والعربي.',
        videoUrl: 'https://play.tlfaz.com/player/#https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr-2/754931856515075b0aabf0e583495c68/index.m3u8',
        subCategory: 'variety'
    },
    {
        id: 'live-mbc2',
        title: 'قناة MBC 2',
        type: 'live',
        category: 'live',
        poster: 'صور/mbc2.jpg',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة MBC 2 بجودة عالية، القناة الأولى في العالم العربي لعرض أحدث وأوروع أفلام هوليوود على مدار الساعة.',
        videoUrl: 'https://tv.qanwatlive.com/2025/03/2_17.html',
        subCategory: 'movies'
    },
    {
        id: 'live-cn-arabic',
        title: 'قناة كرتون نتورك بالعربية',
        type: 'live',
        category: 'live',
        poster: 'صور/cn_arabic.png',
        year: 'بث مباشر',
        quality: 'FHD',
        desc: 'مشاهدة البث المباشر لقناة كرتون نتورك بالعربية (CN Arabic) بجودة عالية، القناة المفضلة لأحبائنا الصغار لمتابعة أحدث مسلسلات الكرتون والمغامرات.',
        videoUrl: 'https://tv.qanwatlive.com/2025/03/blog-post.html',
        subCategory: 'kids'
    },

    {
        id: 'm1',
        title: 'برشامة',
        type: 'movie',
        category: 'arabic-movie',
        poster: 'صور/barshama.jpg', 
        year: '17 مارس 2026',
        quality: 'FHD',
        desc: 'في قالب كوميدي ساخر، وبقلب "ماراثون" الثانوية العامة، وتحديداً داخل إحدى لجان "المنازل"، تنطلق أحداث الفيلم في يوم مصيري واحد وهو امتحان اللغة العربية. يتحول مقر اللجنة من مكان للعلم والوقار إلى ساحة معركة فوضوية يسودها "الغش الجماعي" وتتداخل فيها المصالح والطبقات الاجتماعية.',
        videoUrl: 'https://minochinos.com/embed/tb2gzlrdiul1',
        downloads: {
            medium: 'https://www.mediafire.com/file/h58myixpg0wqvnz',
            high: 'https://www.mediafire.com/file/8zvszlxubn7v1rs'
        }
    },
    {
        id: 'm2',
        title: 'سفاح التجمع',
        type: 'movie',
        category: 'arabic-movie',
        poster: 'صور/safah_altajamoa.jpg',
        year: '19 مارس 2026',
        quality: 'FHD',
        desc: 'في إطار الجريمة والإثارة، يتناول الفيلم قصة قاتل متسلسل يُدعى كريم، نشأ وحيدًا يبحث عن ذاته، فوجد ضالته في عصيان عائلته، وبعد سنوات يقيم علاقة مع فتاة جميلة ويبدأ سلسلة جرائم قتل لعدد من النساء.',
        videoUrl: 'https://vfaststream.co/e/QnFnWOUPyiYN',
        downloads: {
            medium: 'https://vidspeed.org/d/qzc2e6i3rzht.html',
            high: 'https://vik1ngfile.site/f/LTBB8PLQWv'
        }
    },
    {
        id: 'm3',
        title: 'ايجي بيست',
        type: 'movie',
        category: 'arabic-movie',
        poster: 'صور/egybest_movie.jpg',
        year: '19 مارس 2026',
        quality: 'FHD',
        desc: 'دراما مستوحاة من وقائع حقيقية، يغوص الفيلم في كواليس تأسيس "إيجي بست"، المنصة التي هزت عرش حقوق الملكية في العالم العربي، تنطلق الحكاية من زقاق حي المرج القاهري، حيث يقرر صديقان تحويل شغفهما بالشاشة الكبيرة إلى "تمرد رقمي"، متحديين قوانين الصناعة لبناء إمبراطورية قرصنة بدأت من الصفر وتجاوزت حدود التوقعات.',
        videoUrl: 'https://vfaststream.co/e/l9j2p3lYmSpI',
        downloads: {
            medium: 'https://vidspeed.org/d/x1b21ta3yid4.html',
            high: 'https://krakenfiles.com/view/ok4CiFUrd9/file.html'
        }
    },
    {
        id: 'm4',
        title: 'فاميلي بيزنس',
        type: 'movie',
        category: 'arabic-movie',
        poster: 'صور/family_business.jpg',
        year: '19 مارس 2026',
        quality: 'FHD',
        desc: 'تكافح عائلة فقيرة من أجل البقاء على قيد الحياة من خلال عمليات سرقة بسيطة، لكن الأب يقرر ابتكار خطة مختلفة تقوم على حصول كل فرد من أفراد العائلة على وظيفة في منزل عائلة ثرية، مع إخفاء صلة قرابتهم ببعضهم البعض. ويواجهون باستمرار التناقض الصارخ بين عالمهم وعالم أصحاب العمل.',
        videoUrl: 'https://tinyurl.com/3dh34ja8',
        downloads: {
            medium: 'https://www.mediafire.com/file/gt8zu0f2bv2bd65',
            high: 'https://www.mediafire.com/file/1v3p9upi3tnjtlf'
        }
    },
    {
        id: 'fm1',
        title: 'scream7',
        type: 'movie',
        category: 'foreign-movie',
        poster: 'صور/scream7.jpg',
        year: '19 فبراير 2026',
        quality: 'FHD',
        desc: 'في إطار من الرعب، تعيش (سيدني بريسكوت) حياة جديدة في هدوء، قبل أن يظهر قاتل جديد مقنّع في مدينتها، فيعيدها إلى أسوأ كوابيسها حين تصبح ابنتها الهدف التالي.',
        videoUrl: 'https://turbovidhls.com/t/69d051da87291',
        downloads: {
            medium: 'https://vidspeed.org/d/uk29vwcoywqq.html',
            high: 'https://minochinos.com/d/q3zlqay9j8jr'
        }
    },
    {
        id: 'c-zootopia',
        title: 'زوتوبوليس 1 - Zootopia 1',
        type: 'movie',
        category: 'cartoon-movie',
        poster: 'صور/zootopia.jpg',
        year: '2 مارس 2016',
        quality: 'FHD',
        desc: 'فى مدينة زوتوبيا حيث يتعرض الثعلب الثرثار إلى كارثة تؤدي إلى اتهامه بجريمه لم يرتكبها، فيقرر الهروب حتى يثبت براءته، يطارده الأرنب الشرطي المشهور بذكائه وإخلاصه، فيتوصلا معًا أن عليهما الاتحاد لمواجهة مؤامرة كبرى موجهة ضدهما.',
        parts: [
            { id: 'c-zootopia', name: 'الجزء الأول' },
            { id: 'c-zootopia-2', name: 'الجزء الثاني' }
        ],
        versions: [
            {
                name: 'مترجم',
                videoUrl: 'https://hgcloud.to/e/yjdjv8154hvc',
                downloads: {
                    medium: 'https://audinifer.com/f/yjdjv8154hvc_l',
                    high: 'https://audinifer.com/f/yjdjv8154hvc_n'
                }
            },
            {
                name: 'مدبلج',
                videoUrl: 'https://hgcloud.to/e/y2kkfeeialvx',
                downloads: {
                    medium: 'https://audinifer.com/f/y2kkfeeialvx_l',
                    high: 'https://audinifer.com/f/y2kkfeeialvx_n'
                }
            }
        ],
        videoUrl: 'https://hgcloud.to/e/yjdjv8154hvc',
        downloads: {
            medium: 'https://audinifer.com/f/yjdjv8154hvc_l',
            high: 'https://audinifer.com/f/yjdjv8154hvc_n'
        }
    },
    {
        id: 'c-zootopia-2',
        title: 'زوتوبوليس 2 - Zootopia 2',
        type: 'movie',
        category: 'cartoon-movie',
        poster: 'صور/zootopia2.jpg',
        year: '26 نوفمبر 2025',
        quality: 'FHD',
        desc: 'تعاون الأرنب الشجاعة الشرطية جودي هوبس وصديقها الثعلب نيك وايلد من جديد لحل قضية جديدة، وهي الأخطر والأكثر تعقيدًا في مسيرتهما المهنية.',
        parts: [
            { id: 'c-zootopia', name: 'الجزء الأول' },
            { id: 'c-zootopia-2', name: 'الجزء الثاني' }
        ],
        versions: [
            {
                name: 'مترجم',
                videoUrl: 'https://stmruby.com/embed-vqygamk7l027.html',
                downloads: {
                    medium: 'https://hanerix.com/f/8c3f9dskchde_l',
                    high: 'https://hanerix.com/f/8c3f9dskchde_n'
                }
            },
            {
                name: 'مدبلج',
                videoUrl: 'https://stmruby.com/embed-zc4igx63qqeq.html',
                downloads: {
                    medium: 'https://masukestin.com/f/gegvm9z6f7rq_l',
                    high: 'https://masukestin.com/f/gegvm9z6f7rq_n'
                }
            }
        ],
        videoUrl: 'https://stmruby.com/embed-vqygamk7l027.html',
        downloads: {
            medium: 'https://hanerix.com/f/8c3f9dskchde_l',
            high: 'https://hanerix.com/f/8c3f9dskchde_n'
        }
    },
    {
        id: 's-the-boys',
        title: 'The Boys',
        type: 'series',
        category: 'foreign-series',
        poster: 'صور/the_boys.jpg',
        year: '2019 - مستمر',
        quality: 'FHD',
        desc: 'تدور أحداث المسلسل حول مجموعة من الأبطال الخارقون التابعين لوكالة الإستخبارات الأمريكية والذين يتصدون لفساد الأبطال الخارقون المتواجدون في ذلك العالم.',
        seasons: [
            {
                seasonNumber: 1,
                episodes: [
                    { id: 'ep1-1', title: 'الحلقة 1', videoUrl: 'https://hgcloud.to/e/nm8h48ja7rr3', downloads: { medium: 'https://masukestin.com/f/nm8h48ja7rr3_n', high: 'https://masukestin.com/f/nm8h48ja7rr3_h' } },
                    { id: 'ep1-2', title: 'الحلقة 2', videoUrl: 'https://hgcloud.to/e/ks38r0l0bxwf', downloads: { medium: 'https://hanerix.com/f/ks38r0l0bxwf_n', high: 'https://hanerix.com/f/ks38r0l0bxwf_h' } },
                    { id: 'ep1-3', title: 'الحلقة 3', videoUrl: 'https://hgcloud.to/e/3wjvmqq5ecsx', downloads: { medium: 'https://hanerix.com/f/3wjvmqq5ecsx_n', high: 'https://hanerix.com/f/3wjvmqq5ecsx_h' } },
                    { id: 'ep1-4', title: 'الحلقة 4', videoUrl: 'https://hgcloud.to/e/81dkhx6qxhvq', downloads: { medium: 'https://masukestin.com/f/81dkhx6qxhvq_n', high: 'https://masukestin.com/f/81dkhx6qxhvq_h' } },
                    { id: 'ep1-5', title: 'الحلقة 5', videoUrl: 'https://hgcloud.to/e/1okovyu8druh', downloads: { medium: 'https://hanerix.com/f/1okovyu8druh_n', high: 'https://hanerix.com/f/1okovyu8druh_h' } },
                    { id: 'ep1-6', title: 'الحلقة 6', videoUrl: 'https://hgcloud.to/e/qm747rfclz4n', downloads: { medium: 'https://audinifer.com/f/qm747rfclz4n_n', high: 'https://audinifer.com/f/qm747rfclz4n_h' } },
                    { id: 'ep1-7', title: 'الحلقة 7', videoUrl: 'https://hgcloud.to/e/qs2dvti188b7', downloads: { medium: 'https://audinifer.com/f/qs2dvti188b7_n', high: 'https://audinifer.com/f/qs2dvti188b7_h' } },
                    { id: 'ep1-8', title: 'الحلقة 8 والأخيرة', videoUrl: 'https://hgcloud.to/e/gvzk85weaf6l', downloads: { medium: 'https://audinifer.com/f/gvzk85weaf6l_n', high: 'https://audinifer.com/f/gvzk85weaf6l_h' } }
                ]
            },
            {
                seasonNumber: 2,
                episodes: [
                    { id: 'ep2-1', title: 'الحلقة 1', videoUrl: 'https://hgcloud.to/e/nzbwwel30dgq', downloads: { medium: 'https://audinifer.com/f/nzbwwel30dgq_n', high: 'https://audinifer.com/f/nzbwwel30dgq_h' } },
                    { id: 'ep2-2', title: 'الحلقة 2', videoUrl: 'https://hgcloud.to/e/cevm6kpxuyy6', downloads: { medium: 'https://playmogo.com/d/cmb4zwlkol6n', high: 'https://m1xdrop.click/f/0v1q8j79ckx4k3p' } },
                    { id: 'ep2-3', title: 'الحلقة 3', videoUrl: 'https://hgcloud.to/e/ce2lfk6o41g8', downloads: { medium: 'https://hanerix.com/f/ce2lfk6o41g8_n', high: 'https://hanerix.com/f/ce2lfk6o41g8_h' } },
                    { id: 'ep2-4', title: 'الحلقة 4', videoUrl: 'https://hgcloud.to/e/736nxd1qcq8v', downloads: { medium: 'https://playmogo.com/d/kvu2ttzevcd8', high: 'https://m1xdrop.click/f/knz93wqmf3dkkq7' } },
                    { id: 'ep2-5', title: 'الحلقة 5', videoUrl: 'https://hgcloud.to/e/ln8vgeuqgmi9', downloads: { medium: 'https://vibuxer.com/f/ln8vgeuqgmi9_n', high: 'https://vibuxer.com/f/ln8vgeuqgmi9_h' } },
                    { id: 'ep2-6', title: 'الحلقة 6', videoUrl: 'https://hgcloud.to/e/7epfwz0390xz', downloads: { medium: 'https://masukestin.com/f/7epfwz0390xz_n', high: 'https://masukestin.com/f/7epfwz0390xz_h' } },
                    { id: 'ep2-7', title: 'الحلقة 7', videoUrl: 'https://hgcloud.to/e/c4rge3e8omxw', downloads: { medium: 'https://playmogo.com/d/lk6cs96g9uwe', high: 'https://m1xdrop.click/f/6q8z4qlvslel1g3' } },
                    { id: 'ep2-8', title: 'الحلقة 8 والأخيرة', videoUrl: 'https://hgcloud.to/e/iojqdh39jv2a', downloads: { medium: 'https://hanerix.com/f/iojqdh39jv2a_n', high: 'https://hanerix.com/f/iojqdh39jv2a_h' } }
                ]
            },
            {
                seasonNumber: 3,
                episodes: [
                    { id: 'ep3-1', title: 'الحلقة 1', videoUrl: 'https://hgcloud.to/e/fqmr08bwx3p6', downloads: { medium: 'https://masukestin.com/f/fqmr08bwx3p6_n', high: 'https://masukestin.com/f/fqmr08bwx3p6_h' } },
                    { id: 'ep3-2', title: 'الحلقة 2', videoUrl: 'https://hgcloud.to/e/1td29p6w03fo', downloads: { medium: 'https://vibuxer.com/f/1td29p6w03fo_n', high: 'https://vibuxer.com/f/1td29p6w03fo_h' } },
                    { id: 'ep3-3', title: 'الحلقة 3', videoUrl: 'https://minochinos.com/v/kf5gtxurm0l5', downloads: { medium: 'https://playmogo.com/d/xrsiaak247dl', high: 'https://playmogo.com/d/xrsiaak247dl' } },
                    { id: 'ep3-4', title: 'الحلقة 4', videoUrl: 'https://dsvplay.com/e/15irb3bpqzeb', downloads: { medium: 'https://playmogo.com/d/15irb3bpqzeb', high: 'https://playmogo.com/d/15irb3bpqzeb' } },
                    { id: 'ep3-5', title: 'الحلقة 5', videoUrl: 'https://hgcloud.to/e/h0k86no6qpa6', downloads: { medium: 'https://vibuxer.com/f/h0k86no6qpa6_n', high: 'https://vibuxer.com/f/h0k86no6qpa6_h' } },
                    { id: 'ep3-6', title: 'الحلقة 6', videoUrl: 'https://hgcloud.to/e/cvdat54t3zob', downloads: { medium: 'https://masukestin.com/f/cvdat54t3zob_n', high: 'https://masukestin.com/f/cvdat54t3zob_h' } },
                    { id: 'ep3-7', title: 'الحلقة 7', videoUrl: 'https://hgcloud.to/e/b15zg9cjti43', downloads: { medium: 'https://playmogo.com/d/svcl618kty4c', high: 'https://playmogo.com/d/svcl618kty4c' } },
                    { id: 'ep3-8', title: 'الحلقة 8 والأخيرة', videoUrl: 'https://hgcloud.to/e/oooptv6iwlk5', downloads: { medium: 'https://playmogo.com/d/bu20876l1x1b', high: 'https://m1xdrop.click/f/jdv3w6r0sdw7r0' } }
                ]
            },
            {
                seasonNumber: 4,
                episodes: [
                    { id: 'ep4-1', title: 'الحلقة 1', videoUrl: 'https://hgcloud.to/e/qsv3s6z3ng64', downloads: { medium: 'https://playmogo.com/d/mlzwxejiy524', high: 'https://m1xdrop.click/f/pkr1rvqehkwz84' } },
                    { id: 'ep4-2', title: 'الحلقة 2', videoUrl: 'https://hgcloud.to/e/fqdviu2u2dqq', downloads: { medium: 'https://playmogo.com/d/mlzwxejiy524', high: 'https://m1xdrop.click/f/pkr1rvqehkwz84' } },
                    { id: 'ep4-3', title: 'الحلقة 3', videoUrl: 'https://hgcloud.to/e/6h2swfjnl49k', downloads: { medium: 'https://playmogo.com/d/e6lrp11zd3ra', high: 'https://m1xdrop.click/f/9n9j9eklce9zdd' } },
                    { id: 'ep4-4', title: 'الحلقة 4', videoUrl: 'https://hgcloud.to/e/c9swdu3t54w4', downloads: { medium: 'https://playmogo.com/d/xa1cbwsamvs9', high: 'https://m1xdrop.click/f/xoz8kpo7sx6e18' } },
                    { id: 'ep4-5', title: 'الحلقة 5', videoUrl: 'https://hgcloud.to/e/kjn92mivjcnd', downloads: { medium: 'https://audinifer.com/f/kjn92mivjcnd_n', high: 'https://audinifer.com/f/kjn92mivjcnd_h' } },
                    { id: 'ep4-6', title: 'الحلقة 6', videoUrl: 'https://hgcloud.to/e/a391eaf9ztih', downloads: { medium: 'https://vibuxer.com/f/a391eaf9ztih_n', high: 'https://vibuxer.com/f/a391eaf9ztih_h' } },
                    { id: 'ep4-7', title: 'الحلقة 7', videoUrl: 'https://hgcloud.to/e/aor39nard4nd', downloads: { medium: 'https://vibuxer.com/f/aor39nard4nd_n', high: 'https://vibuxer.com/f/aor39nard4nd_h' } },
                    { id: 'ep4-8', title: 'الحلقة 8 والأخيرة', videoUrl: 'https://hgcloud.to/e/09ce4x2yc701', downloads: { medium: 'https://vibuxer.com/f/09ce4x2yc701_n', high: 'https://vibuxer.com/f/09ce4x2yc701_h' } }
                ]
            },
            {
                seasonNumber: 5,
                episodes: [
                    { id: 'ep5-1', title: 'الحلقة 1', videoUrl: 'https://stmruby.com/embed-hh43yh9xs0fo.html', downloads: { medium: 'https://streamruby.com/d/hh43yh9xs0fo_n', high: 'https://streamruby.com/d/hh43yh9xs0fo_o' } },
                    { id: 'ep5-2', title: 'الحلقة 2', videoUrl: 'https://stmruby.com/embed-3zaahq7g26n6.html', downloads: { medium: 'https://streamruby.com/d/3zaahq7g26n6_n', high: 'https://streamruby.com/d/3zaahq7g26n6_o' } }
                ]
            }
        ]
    }
];

// Content filters for each section
const moviesData = allContent.filter(item => item.category === 'arabic-movie');
const seriesData = allContent.filter(item => item.category === 'arabic-series');
const foreignMoviesData = allContent.filter(item => item.category === 'foreign-movie');
const foreignSeriesData = allContent.filter(item => item.category === 'foreign-series');
const cartoonMoviesData = allContent.filter(item => item.category === 'cartoon-movie');
const liveData = allContent.filter(item => item.category === 'live');

// Determine "Latest Additions" -> Exactly the top 4 items of allContent
const latestData = allContent.slice(0, 4);

// Navigation state & logic
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu');
    const navMenuDesktop = document.querySelector('.nav-menu');
    const navMenuMobile = document.getElementById('mobileSectionsMenu');
    const overlay = document.getElementById('sidebarOverlay');
    
    const toggleMenu = () => {
        if(window.innerWidth <= 950) {
            const isActive = navMenuMobile.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active');
            document.body.style.overflow = isActive ? 'hidden' : '';
        } else {
            navMenuDesktop.classList.toggle('active');
        }
    };

    const closeSidebar = document.getElementById('close-sidebar');
    if (menuToggle) menuToggle.addEventListener('click', toggleMenu);
    if (closeSidebar) closeSidebar.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);

    renderHomeSection();
    renderGrid('movies-grid', moviesData);
    renderGrid('foreign-movies-grid', foreignMoviesData);
    renderGrid('cartoon-movies-grid', cartoonMoviesData);
    renderGrid('series-grid', seriesData);
    renderGrid('foreign-series-grid', foreignSeriesData);
    renderLivePage();
    renderGrid('latest-grid', latestData);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch('searchInput'); });
    
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) mobileSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch('mobileSearchInput'); });
    
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            nav.style.backgroundColor = 'rgba(11, 16, 30, 0.98)';
            nav.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
        } else {
            nav.style.backgroundColor = 'rgba(11, 16, 30, 0.85)';
            nav.style.boxShadow = 'none';
        }
    });

    window.addEventListener('popstate', (e) => {
        const pageId = (e.state && e.state.page) ? e.state.page : 'home';
        navigate(pageId, true);
    });

    // On refresh, restore the page from hash and restore watch state
    let initialPage = window.location.hash.replace('#', '') || 'home';
    if (initialPage === 'watch') {
        const savedItem = sessionStorage.getItem('currentWatchItem');
        if (savedItem) {
            watchItem(savedItem, true);
        } else {
            navigate('home');
        }
    } else {
        navigate(initialPage);
    }
});

function renderLivePage() {
    const liveContainer = document.getElementById('live-grid');
    if (!liveContainer) return;
    
    const liveItems = allContent.filter(item => item.category === 'live');
    
    const categories = [
        { id: 'sports', title: 'قنوات رياضية' },
        { id: 'movies', title: 'قنوات أفلام' },
        { id: 'kids', title: 'قنوات أطفال' },
        { id: 'variety', title: 'قنوات متنوعة' }
    ];

    let html = '';
    categories.forEach(cat => {
        const itemsInCat = liveItems.filter(item => item.subCategory === cat.id);
        if (itemsInCat.length > 0) {
            html += `
                <div class="live-category-section" style="width: 100%; grid-column: 1 / -1; margin-top: 2rem;">
                    <h3 class="category-header" style="color: var(--primary); border-right: 4px solid var(--primary); padding-right: 15px; margin-bottom: 20px;">${cat.title}</h3>
                    <div class="grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
                        ${itemsInCat.map(item => createCard(item)).join('')}
                    </div>
                </div>
            `;
        }
    });

    liveContainer.innerHTML = html || '<p style="grid-column: 1/-1; text-align: center;">لا توجد قنوات متاحة حالياً.</p>';
}

function createCard(item) {
    const isSeries = item.type === 'series';
    const isLive = item.type === 'live';
    let badgeHTML = '';
    if (isSeries) {
        badgeHTML = item.hideSeasonText ? `<span class="badge">مسلسل | حلقات</span>` : `<span class="badge">مسلسل | ${item.seasons.length} مواسم</span>`;
    }
    if (isLive) badgeHTML = `<span class="badge" style="background: #22c55e; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.4);"><i class="fas fa-circle" style="font-size: 0.6rem; animation: pulse 1s infinite;"></i> مباشر الآن</span>`;
    return `
        <div class="card">
            <div class="card-img" onclick="watchItem('${item.id}')" ${isLive ? 'style="background: var(--card-bg);"' : ''}>
                ${badgeHTML}
                <img src="${item.poster}" alt="${item.title}" ${isLive ? 'style="object-fit: contain; padding: 2rem;"' : ''}>
                <div class="card-overlay"><i class="fas fa-play-circle play-icon"></i></div>
            </div>
            <div class="card-info">
                <h3 class="card-title" title="${item.title}">${item.title}</h3>
                <div class="card-meta"><span>${item.year}</span><span style="color: var(--primary-color); font-weight: bold;">${item.quality}</span></div>
                <div class="card-actions"><button class="btn btn-watch" onclick="watchItem('${item.id}')"><i class="fas fa-play"></i> شاهد</button></div>
            </div>
        </div>
    `;
}

// Custom navigation stack for reliable back button
const navHistory = [];

function navigate(pageId, fromPopstate = false) {
    if (!fromPopstate) {
        history.pushState({ page: pageId }, '', '#' + pageId);
        // Only push to custom stack if moving to a different page
        if (navHistory[navHistory.length - 1] !== pageId) {
            navHistory.push(pageId);
        }
    }
    document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
    const targetEl = document.getElementById(pageId);
    if (targetEl) {
        targetEl.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (pageId !== 'watch') {
        const videoPlayer = document.getElementById('video-player');
        if (videoPlayer) videoPlayer.src = '';
    }
    document.querySelectorAll('.nav-menu a, .logo').forEach(link => {
        link.classList.remove('active');
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${pageId}'`)) link.classList.add('active');
    });
    const navMenuMobile = document.getElementById('mobileSectionsMenu');
    const navMenuDesktop = document.querySelector('.nav-menu');
    const overlay = document.querySelector('.menu-overlay');
    if (navMenuMobile) navMenuMobile.classList.remove('active');
    if (navMenuDesktop) navMenuDesktop.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function navigateBack() {
    // Remove current page from stack
    navHistory.pop();
    // Go to previous page in stack, or home if stack is empty
    const previousPage = navHistory[navHistory.length - 1] || 'home';
    navigate(previousPage);
}

function renderGrid(containerId, data) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    data.forEach(item => {
        const isSeries = item.type === 'series';
        const isLive = item.type === 'live';
        let badgeHTML = '';
        if (isSeries) {
            badgeHTML = item.hideSeasonText ? `<span class="badge">مسلسل | حلقات</span>` : `<span class="badge">مسلسل | ${item.seasons.length} مواسم</span>`;
        }
        if (isLive) badgeHTML = `<span class="badge" style="background: #22c55e; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.4);"><i class="fas fa-circle" style="font-size: 0.6rem; animation: pulse 1s infinite;"></i> مباشر الآن</span>`;
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-img" onclick="watchItem('${item.id}')" ${isLive ? 'style="background: var(--card-bg);"' : ''}>
                ${badgeHTML}
                <img src="${item.poster}" alt="${item.title}" ${isLive ? 'style="object-fit: contain; padding: 2rem;"' : ''}>
                <div class="card-overlay"><i class="fas fa-play-circle play-icon"></i></div>
            </div>
            <div class="card-info">
                <h3 class="card-title" title="${item.title}">${item.title}</h3>
                <div class="card-meta"><span>${item.year}</span><span style="color: var(--primary-color); font-weight: bold;">${item.quality}</span></div>
                <div class="card-actions"><button class="btn btn-watch" onclick="watchItem('${item.id}')"><i class="fas fa-play"></i> شاهد</button></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderLatestList(containerId, data) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    data.forEach(item => {
        const isSeries = item.type === 'series';
        const typeLabel = isSeries ? 'مسلسل' : (item.type === 'live' ? 'قناة بث' : 'فيلم');
        const listItem = document.createElement('div');
        listItem.className = 'list-item';
        listItem.innerHTML = `
            <div class="list-img" onclick="watchItem('${item.id}')" style="cursor: pointer;"><img src="${item.poster}" alt="${item.title}"></div>
            <div class="list-info">
                <h3 class="list-title">${item.title}</h3>
                <div class="list-tags"><span>${typeLabel}</span><span>${item.year}</span><span>${item.quality}</span></div>
                <p class="list-desc" style="margin-top: 10px;">${item.desc}</p>
            </div>
            <div class="list-actions"><button class="btn btn-watch" onclick="watchItem('${item.id}')" style="padding: 1rem;"><i class="fas fa-play" style="font-size: 1.2rem;"></i> شاهد الآن</button></div>
        `;
        container.appendChild(listItem);
    });
}

function renderHomeSection() {
    renderGrid('home-latest-grid', latestData);
    renderSectionPreview('home-movies-preview', 'home-movies-header', moviesData);
    renderSectionPreview('home-foreign-movies-preview', 'home-foreign-movies-header', foreignMoviesData);
    renderSectionPreview('home-cartoon-movies-preview', 'home-cartoon-movies-header', cartoonMoviesData);
    renderSectionPreview('home-series-preview', 'home-series-header', seriesData);
    renderSectionPreview('home-foreign-series-preview', 'home-foreign-series-header', foreignSeriesData);
    renderSectionPreview('home-live-preview', 'home-live-header', liveData);
}

function renderSectionPreview(gridId, headerId, data) {
    const header = document.getElementById(headerId);
    const grid = document.getElementById(gridId);
    if (!header || !grid) return;
    if (data.length === 0) { header.style.display = 'none'; grid.style.display = 'none'; }
    else { renderGrid(gridId, data.slice(0, 4)); }
}

window.watchItem = async function(itemId, restoreFromSession = false) {
    // التحقق من صلاحية الكود قبل فتح أي فيديو
    const isValid = await isSubscriptionValid();
    if (!isValid) return;

    const item = allContent.find(i => i.id === itemId);
    if (!item) return;

    if (!restoreFromSession) {
        sessionStorage.setItem('currentWatchItem', itemId);
        sessionStorage.removeItem('currentSeason');
        sessionStorage.removeItem('currentEpisode');
        sessionStorage.removeItem('currentMovieVersion');
    }

    navigate('watch');
    const watchInfo = document.getElementById('watch-info');
    let videoUrl = item.videoUrl;
    let downloads = item.downloads;
    let extraHTML = '';

    if (item.type === 'series') {
        let seasonNum, episodeId;
        if (restoreFromSession && sessionStorage.getItem('currentSeason') && sessionStorage.getItem('currentEpisode')) {
            seasonNum = parseInt(sessionStorage.getItem('currentSeason'));
            episodeId = sessionStorage.getItem('currentEpisode');
        } else {
            seasonNum = item.seasons[0].seasonNumber;
            episodeId = item.seasons[0].episodes[0].id;
            sessionStorage.setItem('currentSeason', seasonNum);
            sessionStorage.setItem('currentEpisode', episodeId);
        }

        const season = item.seasons.find(s => s.seasonNumber === seasonNum);
        const episode = season ? season.episodes.find(e => e.id === episodeId) : null;
        
        if (episode) {
            videoUrl = episode.videoUrl;
            downloads = episode.downloads;
            extraHTML = renderSeriesNav(item, seasonNum, episodeId);
        }
    } else {
        if (item.parts && item.parts.length > 0) {
            let partsHTML = item.parts.map(p => `
                <button class="season-btn ${p.id === item.id ? 'active' : ''}" onclick="watchItem('${p.id}')">${p.name}</button>
            `).join('');
            extraHTML += `
                <div class="series-nav-container" style="margin-bottom: 20px;">
                    <div class="seasons-scroll">${partsHTML}</div>
                </div>
            `;
        }
        if (item.versions && item.versions.length > 0) {
            let vIndex = 0;
            if (restoreFromSession && sessionStorage.getItem('currentMovieVersion')) {
                vIndex = parseInt(sessionStorage.getItem('currentMovieVersion'));
            } else {
                sessionStorage.setItem('currentMovieVersion', 0);
            }
            videoUrl = item.versions[vIndex].videoUrl;
            downloads = item.versions[vIndex].downloads;
            let versionsHTML = item.versions.map((v, index) => `
                <button class="episode-btn ${index === vIndex ? 'active' : ''}" onclick="playMovieVersion('${item.id}', ${index}, this)">${v.name}</button>
            `).join('');
            extraHTML += `
                <div class="series-nav-container" style="margin-bottom: 20px;">
                    <div class="episodes-grid">${versionsHTML}</div>
                </div>
            `;
        }
    }
    const player = document.getElementById('video-player');
    if (player) player.src = videoUrl;
    watchInfo.innerHTML = `
        <h1 class="watch-title">${item.title}</h1>
        <div class="watch-badges"><span class="badge-quality">${item.quality}</span><span>${item.year}</span></div>
        <p class="watch-desc">${item.desc}</p>
        ${extraHTML}
        ${item.type !== 'live' ? `
        <div class="download-bar">
            <h3>روابط التحميل:</h3>
            <div class="card-actions" id="download-links" style="margin-top: 1rem;">
                ${downloads ? `<a href="${downloads.medium}" target="_blank" class="btn btn-download"><i class="fas fa-download"></i> جودة متوسطة</a>
                <a href="${downloads.high}" target="_blank" class="btn btn-watch"><i class="fas fa-download"></i> جودة عالية</a>` : '<p>روابط التحميل غير متوفرة حالياً.</p>'}
            </div>
        </div>
        ` : ''}
    `;
}

function renderSeriesNav(series, currentSeasonNum, currentEpisodeId) {
    const season = series.seasons.find(s => s.seasonNumber === currentSeasonNum);
    const episodeIndex = season.episodes.findIndex(e => e.id === currentEpisodeId);
    const prevEp = season.episodes[episodeIndex - 1];
    const nextEp = season.episodes[episodeIndex + 1];
    let seasonsHTML = series.seasons.map(s => `<button class="season-btn ${s.seasonNumber === currentSeasonNum ? 'active' : ''}" onclick="changeSeason('${series.id}', ${s.seasonNumber})">الموسم ${s.seasonNumber}</button>`).join('');
    let episodesHTML = season.episodes.map(e => `<button class="episode-btn ${e.id === currentEpisodeId ? 'active' : ''}" onclick="playEpisode('${series.id}', ${currentSeasonNum}, '${e.id}')">${e.title}</button>`).join('');
    return `
        <div class="series-nav-container">
            <div class="nav-header">
                <div class="episode-controls">
                    <button class="btn-nav" onclick="playEpisode('${series.id}', ${currentSeasonNum}, '${prevEp?.id}')" ${!prevEp ? 'disabled' : ''}><i class="fas fa-chevron-right"></i> الحلقة السابقة</button>
                    <button class="btn-nav next" onclick="playEpisode('${series.id}', ${currentSeasonNum}, '${nextEp?.id}')" ${!nextEp ? 'disabled' : ''}>الحلقة التالية <i class="fas fa-chevron-left"></i></button>
                </div>
            </div>
            ${!series.hideSeasonText ? `<div class="seasons-scroll">${seasonsHTML}</div>` : ''}
            <div class="episodes-grid">${episodesHTML}</div>
        </div>
    `;
}

function changeSeason(seriesId, seasonNum) {
    const series = allContent.find(i => i.id === seriesId);
    const season = series.seasons.find(s => s.seasonNumber === seasonNum);
    playEpisode(seriesId, seasonNum, season.episodes[0].id);
}

function playEpisode(seriesId, seasonNum, episodeId) {
    const series = allContent.find(i => i.id === seriesId);
    if(!series) return;
    
    sessionStorage.setItem('currentWatchItem', seriesId);
    sessionStorage.setItem('currentSeason', seasonNum);
    sessionStorage.setItem('currentEpisode', episodeId);
    
    const season = series.seasons.find(s => s.seasonNumber === seasonNum);
    const episode = season.episodes.find(e => e.id === episodeId);
    const player = document.getElementById('video-player');
    if (player) player.src = episode.videoUrl;
    
    // Update downloads bar
    const downloadLinks = document.getElementById('download-links');
    if (downloadLinks) {
        downloadLinks.innerHTML = episode.downloads ? `
            <a href="${episode.downloads.medium}" target="_blank" class="btn btn-download"><i class="fas fa-download"></i> جودة متوسطة</a>
            <a href="${episode.downloads.high}" target="_blank" class="btn btn-watch"><i class="fas fa-download"></i> جودة عالية</a>
        ` : '<p>روابط التحميل غير متوفرة حالياً.</p>';
    }

    const navContainer = document.querySelector('.series-nav-container');
    if (navContainer) navContainer.outerHTML = renderSeriesNav(series, seasonNum, episodeId);
}

function normalizeText(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim();
}

function handleSearch(inputId) {
    const queryOriginal = document.getElementById(inputId).value;
    const query = normalizeText(queryOriginal);
    if (!queryOriginal.trim()) return;
    navigate('search-results');
    const results = allContent.filter(item => normalizeText(item.title).includes(query));
    renderGrid('search-grid', results);
}

function playMovieVersion(itemId, versionIndex, btn) {
    const item = allContent.find(i => i.id === itemId);
    if (!item || !item.versions || !item.versions[versionIndex]) return;
    
    sessionStorage.setItem('currentMovieVersion', versionIndex);
    
    const version = item.versions[versionIndex];
    const player = document.getElementById('video-player');
    if (player) player.src = version.videoUrl;
    
    const downloadLinks = document.getElementById('download-links');
    if (downloadLinks) {
        downloadLinks.innerHTML = version.downloads ? `
            <a href="${version.downloads.medium}" target="_blank" class="btn btn-download"><i class="fas fa-download"></i> جودة متوسطة</a>
            <a href="${version.downloads.high}" target="_blank" class="btn btn-watch"><i class="fas fa-download"></i> جودة عالية</a>
        ` : '<p>روابط التحميل غير متوفرة حالياً.</p>';
    }
    
    if (btn) {
        const container = btn.closest('.episodes-grid');
        if (container) {
            container.querySelectorAll('.episode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    }
}

// ---- Search Autocomplete Logic ----
window.showSuggestions = function(query, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const queryOriginal = query;
    query = normalizeText(query);
    
    if (!queryOriginal.trim()) {
        container.style.display = 'none';
        return;
    }
    
    // Filter and Sort logic
    const results = allContent
        .filter(item => {
            const nTitle = normalizeText(item.title);
            // If query is very short (1-2 chars), it MUST start the title or start a word
            if (query.length <= 2) {
                return nTitle.startsWith(query) || nTitle.includes(' ' + query);
            }
            // For longer queries, keep the "includes" logic
            return nTitle.includes(query);
        })
        .sort((a, b) => {
            const aTitle = normalizeText(a.title);
            const bTitle = normalizeText(b.title);
            const aStarts = aTitle.startsWith(query);
            const bStarts = bTitle.startsWith(query);
            
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            
            // Priority to word starts
            const aWordStart = aTitle.includes(' ' + query);
            const bWordStart = bTitle.includes(' ' + query);
            if (aWordStart && !bWordStart) return -1;
            if (!aWordStart && bWordStart) return 1;

            return aTitle.length - bTitle.length;
        })
        .slice(0, 5); // top 5
    
    if (results.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--text-muted); text-align: center; font-size: 0.9rem;">لاتوجد نتائج...</div>';
        container.style.display = 'block';
        return;
    }
    
    let html = '';
    results.forEach(item => {
        let typeLabel = '';
        if (item.type === 'movie') typeLabel = 'فيلم';
        else if (item.type === 'series') typeLabel = 'مسلسل';
        else if (item.type === 'live') typeLabel = 'بث مباشر';
        else typeLabel = 'أخرى';
        
        html += `
            <div class="suggestion-item" onclick="watchItem('${item.id}'); document.getElementById('${containerId}').style.display='none';">
                <img src="${item.poster}" alt="${item.title}" class="suggestion-img">
                <div class="suggestion-info">
                    <h4>${item.title}</h4>
                    <p>${typeLabel} ${item.year ? '• ' + item.year : ''}</p>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.style.display = 'block';
};

window.hideSuggestions = function(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.display = 'none';
    }
};
