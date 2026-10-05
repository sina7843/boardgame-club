# جهت بصری و تحویل رابط

فضای باشگاه حرفه‌ای بردگیم؛ فارسی و RTL واقعی. زمینه #101522، سطح #1B2233، سطح دوم #252F44، متن اصلی #F4F6FC، متن ثانویه #B6C0D4، اقدام #8B5CF6، طلایی محدود #D6AD60. کنتراست ترکیب‌های واقعی بررسی شود؛ از طلایی برای متن ریز بدون آزمون استفاده نشود. فونت فارسی خوانا مانند Vazirmatn با fallback مناسب، فایل محلی و متن پایه ۱۶px؛ نام لاتین در bdi. spacing بر پایه ۴/۸؛ radius ۸/۱۲/۱۶؛ motion کوتاه ۱۲۰–۲۰۰ms و احترام به reduced-motion.

دسکتاپ: ناوبری راست، ستون اصلی میانی؛ «نوبت من» و «شروع بازی» اولویت داشبورد. موبایل از ۳۶۰px: ناوبری پایین، drawer در میز، لمس حداقل ۴۴px. برد مرکزی، دست بازیکن پایین، نوبت/تایمر آشکار، چت/تاریخچه جمع‌شونده؛ مختصات برد آینه نشود. zoom/pan برای برد متراکم؛ انتخاب کارت و تأیید حرکت قابل استفاده با لمس و صفحه‌کلید.

Components: Button/Input/Select/Tabs/GameCard/Badge/LeagueBadge/Progress/Timer/Avatar/Dialog/Drawer/Toast/Table + Board/Card/Token/Hand/PlayerSeat/TurnIndicator/ActionBar. Semantic tokens shared; game theme override controlled. Loading/empty/error/offline/permission-denied states and focus management are part of each relevant screen, not a final decoration pass.

Screen inventory: ورود، داشبورد، کاتالوگ، صفحه بازی، آموزش، ساخت میز، لابی، صف، میز زنده/نوبتی، نتیجه، پروفایل، رتبه و لیگ، مأموریت/دستاورد، دوستان/پیام‌ها، گروه/باشگاه، پلن/پرداخت، تنظیمات، پشتیبانی، مدیریت. Page routes should be real and integrated by their phase. Every final page needs honest states and no silent fake success.

Deliver source tokens/components, a component showcase and screenshots at 360/768/1440/1920; note devices actually tested. Editable frontend source is the design handoff in this package; native design files are a separate deliverable if requested.
