NEON ROOM — TIKTOK LIVE BAR V16 / CHAT DIAGNOSTICS + FULL HD LIVE
=============================

CHẠY TRÊN MÁY WINDOWS
1. Cài Node.js 22 trở lên nếu chưa có: https://nodejs.org
2. Nhấp đúp start.bat. Giữ cửa sổ máy chủ đang chạy.
3. Bảng điều khiển: http://127.0.0.1:8080/?control=1
4. Bấm “Tạo sàn thử 36 người”, thử Rose, Galaxy, Follow và Zoom.
5. Bấm “Xóa người thử” trước khi phát sóng.
Không cần npm install, không cần tải avatar hoặc tài nguyên mạng.
Nếu máy chủ đã chạy, mở thẳng đường dẫn bảng điều khiển.

MÔ PHỎNG TẶNG XU
- Mở bảng điều khiển, mục “MÔ PHỎNG TẶNG XU”.
- Chọn người thử có sẵn hoặc tạo người thử mới và nhập tên.
- Nhập xu mỗi quà (1–10.000) và số lượng (1–100), rồi bấm Tặng xu mô phỏng.
- Ví dụ 10 xu × 3 = 30 xu mở Băng Lam. Tặng tiếp 20 xu cho cùng người lên Tử Tinh.
- Người vừa tạo tự được giữ trong ô chọn để bạn thử cộng dồn.
- Có nút nhanh 1/10/30/50/100/150/200/300 xu, dự tính tổng xu và bậc cánh sau lần tặng.
- Chỉ người thử nhận được quà mô phỏng; không thanh toán và không sửa điểm người thật.
- Người thử và xu thử không lưu vào phiên thật. Xóa người thử trước khi LIVE.

KẾT NỐI TIKTOK LIVE
1. Mở TikFinity Desktop trên cùng máy, thiết lập tài khoản/username của bạn.
2. Bắt đầu phòng LIVE và kết nối TikFinity vào đúng phòng.
3. Ứng dụng tự nối Event API tại IPv4 127.0.0.1, cổng 21213, thử lại mỗi 3 giây và có thời hạn chờ kết nối.
4. Trạng thái Event API chỉ nói đã nối tới TikFinity, chưa chứng minh phòng LIVE có sự kiện.
5. Dùng tài khoản xem khác chat “hey”, kiểm tra tên nhân vật xuất hiện.
6. Kiểm tra dòng “Đã nhận tương tác thật” trong bảng điều khiển.
7. Mục KIỂM TRA CHAT TỪ PHÒNG LIVE hiện riêng số gói, tin chat và sự kiện đã xử lý.
   Nếu GÓI NHẬN / TIN CHAT vẫn là 0: kiểm tra username và kết nối phòng LIVE trong TikFinity.
   Nếu TIN CHAT tăng: xem tin gần nhất và trạng thái xử lý. hey nhận cả chữ hoa, ký tự ẩn và dạng chữ rộng.
   Nút Thử hey cục bộ tạo người thử, không xác nhận kết nối tới TikTok.
   Nút Kết nối lại TikFinity mở lại kết nối cục bộ, giữ nguyên người xem và xu.
Tài liệu chính thức: https://tikfinity.zerody.one/tiktok/actionsandevents

ĐƯA VÀO TIKTOK LIVE STUDIO
1. Thêm nguồn → Liên kết.
2. Dán nguyên dòng: http://127.0.0.1:8080/#tiktok.studio
3. Bật Độ phân giải tùy chỉnh: W 1080, H 1920. Kéo nguồn phủ khung dọc.
   Sân khấu vẽ trực tiếp 1080 × 1920 (Full HD), giữ bố cục dọc và nhịp khoảng 30 FPS.
4. Giữ Luôn giữ trạng thái hoạt động bật, rồi bấm Thêm nguồn.
5. Dùng nguồn âm thanh máy tính nếu phát nhạc tại bảng điều khiển.
Link ?control=1 dành cho điều khiển. Trong bảng điều khiển có hai ô copy riêng cho LIVE Studio và OBS.
LIVE Studio 1.39.2 kiểm tra dạng tên miền nên từ chối link IP thuần. Giữ #tiktok.studio ở cuối link.
Máy chủ cho phép LIVE Studio kiểm tra trang HTML bằng XHR; API điều khiển và dữ liệu vẫn giữ giới hạn gốc.
Tham khảo cách dùng link nội bộ: https://luckydamo.com/downloads/tiktok-live-studio-guide-en

KIỂM TRA ĐỘ NÉT
- Xem mục ĐỘ NÉT / NGUỒN HÌNH LIVE trong bảng điều khiển sau khi mở nguồn Link.
- Link tự báo kích thước đang thu về máy chủ. Nguồn 800×600, 720×1280 hoặc sai tỷ lệ được cảnh báo.
- Đặt nguồn Link W 1080 / H 1920, đặt chất lượng phát 1080p / 30 FPS và kiểm tra tốc độ mạng trong LIVE Studio.
- Ưu tiên độ nét khi LIVE là chế độ mặc định mới: giảm tia mảnh, hạt lấp lánh nền và tăng kích thước ô LED.
  Chuyển Đầy đủ hiệu ứng nền để dùng lại mật độ hiệu ứng cũ. Nhân vật, cánh, quà và phi kiếm vẫn hoạt động.
- Báo nguồn đủ Full HD chỉ xác nhận kích thước trang, không đo được bitrate, chất lượng TikTok nén hay chất lượng mạng của người xem.
- Kiểm tra phát bằng tài khoản xem khác. Chọn chất lượng cao nhất có sẵn trên điện thoại khi so sánh.

ĐƯA VÀO OBS
1. Đặt canvas dọc 1080 × 1920.
2. Add Source → Browser.
3. URL: http://127.0.0.1:8080/
4. Width 1080, Height 1920, FPS 30. Fit to Screen.
5. Không dùng URL ?control=1 làm nguồn LIVE; URL đó có bảng điều khiển.
6. Thêm nhạc, webcam/video DJ thành nguồn riêng nếu muốn.
7. Nếu dùng nhạc qua bộ chọn trong bảng điều khiển, thu âm thanh trình duyệt
   bằng Desktop Audio/Application Audio Capture của OBS. Nguồn sân khấu không tự phát nhạc.
8. Thực hiện bước bắt đầu phát sóng trong phần mềm LIVE/tài khoản của bạn.
Ứng dụng này cung cấp cảnh tương tác, không đăng nhập hay tự bấm phát LIVE.

LỆNH CHAT
hey / 1 / nhảy / nhay / dance : vào sàn và nhảy
zoom / to len               : camera zoom tại vị trí trong khoảng 4 giây
đổi nv / doi nv             : đổi giữa 14 kiểu nhân vật
furina / klee / ironman / hulk : chọn thẳng nhân vật mới (iron man cũng dùng được)
wanderer / mitya / neuvillette / zhongli / venti : chọn nhân vật Genshin tương ứng
neuvilette cũng được nhận như neuvillette.
đi vòng / di vong           : đi quanh sàn 10 giây
nhỏ lại / nho lai           : bỏ zoom của chính mình
camera                     : đổi góc bố trí sàn
Lệnh cùng loại của cùng người được giới hạn mỗi 1,8 giây.

TƯƠNG TÁC
Mọi quà: vào sàn và cộng giá trị quà × số lượng. Chỉ mở cánh mới mới khoe nhân vật lớn.
Rose / Hoa Hồng: camera zoom đúng vị trí người tặng trong khoảng 4 giây, rồi trở lại góc cũ.
Các nhân vật khác giảm độ rõ và độ sáng khi zoom, tự trở lại bình thường sau đó.
Quà có tổng đúng 10 / 20 / 50 xu mỗi lượt: Thanh Phong / Tử Lôi / Long Vương.
Mỗi lượt bay đúng một vòng rồi về vị trí; 12 giây gồm cất cánh, một vòng tròn, hạ xuống.
Có ba nút thử trong mục PHI KIẾM. Nhiều lượt tặng nối tiếp xếp hàng thành từng vòng riêng.
Quà phi kiếm bỏ màn khoe cánh để bay ngay theo lượt, nhưng vẫn cộng xu và nâng cánh tương ứng. Màn khoe cánh từ quà khác có thể tạm dừng vòng đang bay.
Đuôi sao lam / tím / vàng kéo dài 2,6 / 3,4 / 4,4 giây; kiếm cao cấp có nhiều bóng ảnh hơn khi phi nhanh.
Mỗi người có một nhân vật thật; các bóng ảnh mờ chỉ là hiệu ứng chuyển động.
Rose giữ nhân vật ở đúng vị trí thực trên sàn, bục hoặc phi kiếm.
TikTok: đi một vòng sàn.
Finger Heart: nhân vật VIP có vương miện.
Quà tổng từ 100 kim cương: đại tiệc ánh sáng đổi màu.
Follow: đôi cánh. Subscribe: VIP và đại tiệc. Like: tăng ánh sáng 4,5 giây.
Share: nhảy sôi động. Các tên quà phụ thuộc dữ liệu TikFinity gửi về.
Chuỗi quà loại giftType=1 chỉ tính khi repeatEnd kết thúc; tin trùng msgId bị bỏ qua.

DỮ LIỆU VÀ GIỚI HẠN
- TOP 3 xếp theo kim cương quà, không trộn điểm like/follow vào kim cương.
- Màn LIVE có bảng TOP 3 tặng xu nhỏ ở góc trên bên phải, hiện tên và tổng xu cộng dồn.
  Thứ hạng cập nhật cùng ba bục; tên dài được rút gọn trên màn hình, số xu dùng dấu phân cách Việt Nam.
  Hướng dẫn và thông tin cánh nằm ở bảng điều khiển. Thông báo mở cánh nằm bên trái bảng TOP.
- Góc dưới bên phải có note nhỏ “QUÀ & HIỆU ỨNG”: Hoa hồng zoom, Finger Heart nhận VIP,
  tổng từ 30 xu mở cánh + VIP, 10/20/50 xu mỗi lượt cưỡi phi kiếm một vòng.
  Note ghi đủ sáu mốc cánh và phân biệt xu cộng dồn với xu từng lượt; tự lấy mốc từ danh mục cánh/kiếm.
- Phần chân màn LIVE gom thông báo, lời mời chat hey và số người vào một bảng nền tối viền neon.
  Tên club ở chân màn đồng bộ với tên đã đặt. Nhãn góc camera trên màn LIVE đã được gỡ.
- Có 5 mẫu meme và 9 mẫu chibi: Furina, Klee, Iron Man, Hulk,
  Wanderer, Mitya, Neuvillette, Zhongli và Venti.
  Người mới vào được chọn ngẫu nhiên; chat tên nhân vật để chọn hoặc đổi nv để luân phiên.
  Mục NHÂN VẬT MỚI có chín nút thêm người thử. Cánh, VIP, Rose và phi kiếm dùng được với cả 14 mẫu.
  Finger Heart giữ nguyên mẫu nhân vật mới đang chọn.
  Neuvillette và Zhongli: tay ngang hông, đấm đan chéo xuống phía trước và lắc hông.
  Furina: hai tay ngang vai, nắm tay đấm xen kẽ lên xuống.
  Venti: lảo đảo qua hai bên, bước chân loạng choạng và vung tay kiểu say rượu.
  Các điệu riêng được giữ khi nhảy trên sàn và bục; lên phi kiếm chuyển sang giữ thăng bằng.
  Wanderer và Mitya dùng các động tác ngẫu nhiên theo nhịp sàn.
- Có ba bục trước bàn DJ NR: TOP 1 giữa cao nhất, TOP 2 trái, TOP 3 phải.
  Bục DJ phía sau được nâng cao và mở rộng, có bàn DJ hai mâm đĩa và mixer.
  Bục sau hiện rộng 1.680, sâu 400 đơn vị; hai vũ công cách DJ 470 đơn vị mỗi bên.
  DJ ở giữa cao hơn, mặc vest, cà vạt và tai nghe; một tay đánh đĩa, tay còn lại chỉnh mixer.
  Hai vũ công ở hai bên DJ trên cùng bục. Ba bục TOP phía trước giữ nguyên.
  Ba bục TOP 1–2–3 giữ độ cao cũ và nằm tách riêng phía trước bục DJ.
  Vùng đứng rộng 1.400 và sâu 1.700 đơn vị, lớn hơn khoảng sáu lần bố cục trước.
  Đám đông đứng rải ngẫu nhiên trên sàn, chọn chỗ trống để giảm chồng lấp.
  Vị trí không bốc lại theo từng khung hình; người mới vào không xô lại cả đám đông.
  Nhân vật đứng trên bục, giữ cánh và gậy đèn; có tên, hạng và tổng xu quà.
  Thứ hạng tự cập nhật khi có người vượt xu. Người trên bục không xuất hiện lặp trong đám đông.
  Chưa đủ ba người tặng quà thì bục còn lại chờ người lên TOP.
  preview-podium.png minh họa sân khấu có ba bục.
- Tối đa 120 nhân vật cùng trên sàn; khi đầy, người ít tương tác nhất nhường chỗ.
  Điểm quà của họ vẫn còn. Phiên lưu tối đa 2.000 hồ sơ trong bộ nhớ.
- live-state.json lưu tên, điểm, nhân vật, cánh và cấu hình trên máy.
  Người thử không lưu. Sau khởi động lại, giữ điểm nhưng sàn chờ người xem vào lại.
- Hai nguồn OBS và bảng điều khiển nhận chung trạng thái từ máy chủ.
- “Bắt đầu phiên mới” có hộp xác nhận xóa bảng điểm của phiên hiện tại.
- Đây là sân khấu 2.5D Canvas với nhân vật meme và vũ công sprite, không phải mô hình 3D
  hoặc video DJ của ảnh mẫu. Không kèm nhạc. Nhịp nhảy là hoạt ảnh lập trình.
- Ảnh preview-live.png và preview-control.png minh họa chế độ thử.
- preview-characters.png: bộ mặt meme gấu trúc cười đểu, cười lớn,
  khóc cười, đầu nấm và gấu trúc VIP. Chat “đổi nv” để đổi mẫu.
- assets/meme-heads.png là atlas 2 × 2 nền trong suốt được tạo dựa theo
  ảnh meme tham khảo. Phải giữ thư mục assets khi sao chép ứng dụng.
- tiktok-live-bar-v1.zip là bản gốc cũ, không phải bản mới.

SÀN QUẨY / DANCE ENGINE
- 8 kiểu động tác tự luân phiên, lệch nhịp theo từng người: bật nhảy giơ tay, shuffle,
  fist pump, headbang, xoay tay, lắc hông, nhảy dây neon và cuộn hai tay trước ngực.
- Nhịp mặc định 148 BPM. Chỉnh BPM 90–180 và độ cháy 60–180% trong bảng điều khiển.
- Camera có 8 góc: chính diện, chéo trái, bên trái, phía sau, bên phải,
  chéo phải, từ trên cao và siêu rộng. Mặt sàn và sân khấu dùng phép chiếu phối cảnh.
- Chọn góc ở mục CAMERA / QUANH SÀN hoặc bấm Đổi góc nhìn để chuyển góc tiếp theo.
  Camera chuyển mượt khoảng 1,25 giây, đồng thời bỏ zoom nhân vật.
- Camera mặc định lướt phía trước, sang trái/phải tối đa 60°, một vòng 3 phút 20 giây (nhanh hơn 20%).
  Camera đi xuyên qua góc giữa để sang bên còn lại; chỉ đổi chiều ở hai biên trái/phải.
  Chuyển động giảm tốc tại hai đầu, giữ nguyên độ cao và khoảng cách.
  Mục Chuyển động cho phép giữ nguyên góc hiện tại hoặc bật lại lướt chậm.
  Khi đang lướt, chọn góc máy hoặc chat camera sẽ đổi góc tạm 8 giây rồi trở về lướt trong 12 giây.
  Camera chỉ dừng hẳn khi chọn Giữ góc cố định. Nút Tiếp tục camera lướt giữ pha chuyển động,
  không đưa camera về giữa hay bắt đầu sang phải lại. Tạm dừng rồi tiếp tục cũng giữ pha cũ.
  Rose zoom tạm tại người tặng rồi tiếp tục chuyển động camera.
  Thanh độ gần/rộng chỉnh từ 70% đến 130%. Nhân vật tự xếp theo chiều sâu.
- camera.js, wing-catalog.js và sword-catalog.js phải đi cùng ứng dụng.
- Hiệu ứng sàn theo video mẫu: đèn rọi hình nón quét sàn, chùm laser chéo dày,
  sương màu, LED ma trận hai bên, bảng chữ LED chạy và cầu disco ô gương quay.
- Bốn bức tường LED bao quanh sàn: ma trận đổi màu, cột sáng và nhịp equalizer.
  Camera nhìn vào mặt trong của phòng, tường phía gần không chắn sân khấu khi đổi góc.
- Giàn đèn ở cao 2.800 đơn vị, chỉ thấy chùm sáng đi xuống, không còn chấm sáng đầu đèn.
- Cầu disco lớn ở giữa có quầng sáng, gương màu, tia sáng và đốm phản chiếu chạy trên tường/sàn.
- Cầu disco đã được phóng lớn và đưa về phía giữa vùng sàn nhảy, tách khỏi mặt các vũ công trên bục.
- Cảnh được phóng gần thêm 6%, nhân vật lớn hơn khoảng 5–6%, giữ vùng đứng giãn rộng.
- Ánh sáng chuyển màu mượt theo nhịp BPM, có vệt phản chiếu trên nền và phản chiếu nhẹ nhân vật.
  Nền sàn và trần mở rộng ra ngoài khung hình, không còn viền hộp trước sàn khi camera quét.
  Bố cục DJ, hai vũ công và bục TOP giữ nguyên.
- preview-floor-effects.webm minh họa hiệu ứng thường và khi bấm DROP.
- Nút DROP tăng hiệu ứng 8 giây, không tạo kim cương hay thay đổi bảng quà.
- Follow hoặc VIP có cánh thiên thần cơ bản. Cánh cao cấp nâng theo tổng xu quà:
  30 xu — Băng Lam; 50 xu — Tử Tinh; 100 xu — Lục Bảo;
  150 xu — Lôi Đình; 200 xu — Thiên Hà; 300 xu — Phượng Hoàng.
  Thời gian khoe cánh mới: 5 giây cho năm bậc đầu, riêng Phượng Hoàng 15 giây.
  Chỉ hiện nhân vật lớn khi vừa vượt mốc cánh; tặng tiếp trong cùng bậc không phát lại.
  Follow, subscribe và quà thường không phóng nhân vật lớn.
  Ví dụ 20 + 10 xu mở Băng Lam; tặng thêm 20 xu nâng Tử Tinh.
  Tặng bất kỳ quà nào đều cộng theo giá trị quà TikFinity gửi.
  Giữ bậc cao nhất trong phiên, lưu qua lần khởi động lại. Phiên mới xóa bậc cánh.
  Follow/like và đổi nhân vật không mở cánh cao cấp.
  Sáu nút Thử 30/50/100/150/200/300 xu tạo người thử riêng, không lưu điểm thật.
  preview-wings.png minh họa sáu bậc; assets/fantasy-wings.png và
  assets/fantasy-wings-extra.png là hai atlas cánh.
- Cánh bung–khép và đập theo nhịp BPM, có sao bốn cánh lấp lánh quanh lông vũ.
  preview-wings-motion.webm minh họa chuyển động và ánh sao của sáu bậc cánh.
- Sao để lại vệt theo chuyển động đầu cánh, trôi và mờ dần trong khoảng 0,5–0,75 giây.
  Số hạt có giới hạn để không tăng mãi khi sàn đông.
- Mỗi nhân vật cầm 2 gậy LED bám theo cổ tay, nhấp nháy luân phiên theo BPM.
  Gậy LED theo màu bar; cánh cao cấp giữ màu riêng của từng bậc.
- Người mới vào sàn rơi từ trên xuống, chạm sàn nảy nhẹ và bung vòng sáng.
  Hiệu ứng dùng thời gian từ máy chủ để đồng bộ OBS/bảng điều khiển.
  Chat tiếp hoặc tặng quà khi đã ở trên sàn không làm rơi lại.
- preview-entry.webm minh họa hiệu ứng người mới vào sàn.
- BPM là nhịp hoạt ảnh do bạn chọn, không tự nhận diện nhạc.
- preview-dance.webm là đoạn quay trực tiếp hoạt ảnh (không có âm thanh).
- preview-podium.png minh họa bố cục đã sửa: bục DJ cao phía sau, hai vũ công hai bên,
  và ba bục TOP thấp ở phía trước.
- preview-dj-stage.webm quay cận sân khấu, bàn DJ và thao tác DJ mặc vest.
- preview-expanded-floor.png minh họa sàn mở rộng ở góc chéo.
- preview-new-dances.png minh họa xoay tay, lắc hông và nhảy dây.
- preview-sword-flight.webm quay cất cánh, bay quanh sàn, Rose làm mờ người khác và hạ xuống.
- preview-full-stage.png minh họa sân khấu toàn khung, đám đông giãn rộng.
- preview-sword-tiers.png so sánh ba mẫu kiếm 10 / 20 / 50 xu.
- preview-three-swords.webm quay ba loại kiếm bay một vòng với đuôi sao dài và bóng ảnh.
- preview-led-room.webm quay bục rộng, bốn tường LED và cầu disco phát sáng với 82 người thử.
- preview-new-characters.webm minh họa Furina, Klee, Iron Man và Hulk chuyển động.
- preview-genshin-dances.webm minh họa năm nhân vật Genshin mới và điệu nhảy mới của Furina.
- assets/characters/ chứa ảnh chibi, prompts.txt và genshin-prompts.txt; Iron Man được vẽ bằng Canvas trong app.js.
  character-catalog.js phải đi cùng ứng dụng.
- assets/stage-dancers.png chứa bốn tư thế nhảy cho hai vũ công, phải giữ khi sao chép ứng dụng.
- assets/stage-dancers-roll.png chứa 8 tư thế cuộn hai tay cho mỗi vũ công (bảng 4 × 4).
  Hai cô gái cuộn tay trước người, lắc hông và hẩy hông theo BPM, lệch nhau nửa vòng.
  Bàn chân giữ trên bục; hiệu ứng uốn nhẹ tại eo không làm xoay cả người.
  preview-stage-arm-roll.webm quay động tác mới. Prompt tạo ảnh nằm trong assets/stage-dancers-roll.prompt.txt.

KIỂM TRA KỸ THUẬT
node --test engine.test.js connection.test.js
node verify-preview.cjs
node preview-check.cjs
verify-preview chạy máy chủ thử riêng, chặn kết nối TikFinity thật và không thay đổi phiên LIVE đang mở.
verify-preview cần Chrome ở vị trí mặc định hoặc biến môi trường CHROME_PATH; tự tạo và dọn máy chủ thử.
preview-check trực tiếp cần máy chủ có người thử; chỉ dùng với máy chủ thử riêng, không chạy vào phiên LIVE thật.

KHẮC PHỤC
- Không vào web: xem cửa sổ start.bat, kiểm tra Node hoặc cổng 8080 đang bận.
- CHỜ TIKFINITY: mở Desktop App, kiểm tra Event API cổng 21213.
- Event API đã kết nối nhưng chưa có người: nối TikFinity vào LIVE, chat hey.
- OBS đen: kiểm tra URL, kích thước và tải lại nguồn trình duyệt.
- Nhạc không có trên LIVE: kiểm tra nguồn thu âm của OBS.













GIẢM ĐỘ TRỄ / V16.2
- Chat hợp lệ, quà, follow, share và subscribe đẩy tới sân ngay, bỏ hàng đợi 70 ms. Like và chẩn đoán vẫn gộp để tránh quá tải.
- Người mới rơi xuống trong 420 ms thay vì 850 ms; giữ hiệu ứng tiếp đất.
- Preview trong bảng điều khiển giới hạn 15 FPS và dừng khi tab bị ẩn. Nguồn sân khấu vẫn 30 FPS, vẽ 1080 × 1920.
- Chẩn đoán hiển thị tuổi sự kiện theo createTime của nguồn và thời gian xử lý trong code. Đồng hồ nguồn khác giờ hoặc thiếu createTime sẽ không có số đo. Đây không phải độ trễ video TikTok.
- Khi đang LIVE: tải lại nguồn Link để nạp app.js mới. Phần máy chủ 16.2 nạp khi đóng cửa sổ máy chủ cũ rồi chạy start.bat lại; nên thực hiện sau buổi LIVE.
- Phiên LIVE hiện tại không bị khởi động lại tự động; điểm xu thật tiếp tục được lưu bởi máy chủ đang chạy.

CHỌN 5 NHÂN VẬT MẪU / V16.3
- Trong bảng điều khiển có 5 ô nhân vật với tên ngẫu nhiên và hình xem trước. Chọn một ô rồi bấm "Thêm ... vào sàn".
- Nhân vật đang chọn cũng là người nhận trong "Mô phỏng tặng xu". Đổi ô hoặc đổi tên trong danh sách đều dùng chung một lựa chọn.
- Nếu tặng xu trước khi thêm, đúng nhân vật đang chọn sẽ vào sàn và nhận xu. Thêm lại người đã có không tạo bản sao; tặng tiếp cộng xu cho cùng người đó.
- Các nút thử Rose, Galaxy, Follow và Zoom cũng áp dụng cho người đang chọn. Dùng "Xóa người thử" để dọn nhân vật mô phỏng; 5 ô lựa chọn trở về 0 xu.
- Muốn tạo thêm tên khác, chọn "+ Tạo người thử mới" trong danh sách. Có thể để trống ô tên để chọn tên ngẫu nhiên.
- Sau buổi LIVE, đóng máy chủ cũ, chạy start.bat rồi tải lại bảng điều khiển để nạp bản 16.3.

PHI KIẾM CHO NGƯỜI ĐANG CHỌN / V16.4
- Ba nút phi kiếm 10, 20 và 50 xu dùng cùng nhân vật đã chọn trong 5 ô mẫu hoặc danh sách tặng xu.
- Dòng "Người cưỡi phi kiếm" hiện đúng tên người sẽ bay. Nếu chưa vào sàn, người đó sẽ được thêm vào sàn; tên và mẫu nhân vật được giữ nguyên.
- Các lần thử cộng xu và xếp lượt bay cho cùng người, không sinh thêm nhân vật. Đổi lựa chọn sẽ chuyển phi kiếm sang người mới chọn.
- Sau buổi LIVE, đóng máy chủ cũ, chạy start.bat và tải lại bảng điều khiển để nạp bản 16.4.

NHÂN VẬT VÀ ĐỘNG TÁC TAY KHÔNG / V16.5
- Đã tham khảo video https://www.tiktok.com/@tiin.vn/video/7667766647301754132: các đoạn cận cảnh áo xanh, áo hồng và meme đen trắng.
- Thêm Nấm Xanh (groove ngang), Nấm Hồng (bước chéo), Nấm Meme (bật mở tay), vẽ bằng Canvas với bộ mặt meme có sẵn. Chat "nam xanh", "nam hong", "nam meme" để chọn.
- Nhân vật tự do có thêm groove ngang, bước chéo, shuffle gót chân, bật mở tay, twist và đá chân. Chuyển điệu trong 0,65 nhịp, mỗi người lệch pha.
- Mục "NHỊP SÀN" có "Đạo cụ khi nhảy": mặc định đa số tay không, hoặc chọn tất cả tay không / tất cả cầm LED. Người cưỡi kiếm giữ tay thăng bằng.
- Các điệu riêng của Furina, Neuvillette, Zhongli và Venti được giữ. Klee dùng các động tác vui chơi, nhún nhảy.
- Nút thêm nhân vật mới tự chọn đúng người đó trong mô phỏng tặng xu và phi kiếm.
- Sau buổi LIVE: đóng máy chủ cũ, chạy start.bat, tải lại bảng điều khiển và nguồn sân khấu.
- Kiểm tra: node --test engine.test.js connection.test.js dance-motion.test.js

ÁNH SÁNG SÂN KHẤU
- Bỏ các tia laser mảnh quét vòng quanh và các vệt mảnh tỏa từ quả cầu disco.
- Tăng đèn chùm lớn từ 7 lên 14, mở rộng chùm sáng và các vùng sáng trên sàn. Lớp đèn trước nhân vật được giữ nhẹ để tránh che mặt.
- Ba vòng tròn trên sàn dùng dải sáng dày hơn; quả cầu disco vẫn treo trên tâm của chúng.
- Tải lại nguồn Link sân khấu để nạp thay đổi ánh sáng.

HAI VŨ CÔNG Ở CÁC GÓC CAMERA
- Bảng phía sau và bục lớn được vẽ trước người đứng trên bục, tránh che chân hoặc vẽ đè lên vũ công khi nhìn chéo.
- Camera tự dịch khung và nới góc vừa đủ khi vũ công sắp ra ngoài mép. Chuyển động lướt và các góc chọn vẫn hoạt động.
- Zoom theo người tặng Rose vẫn tập trung đúng người đó; hiệu ứng làm mờ những người khác được giữ.
- Tải lại nguồn Link sân khấu để áp dụng. Kiểm tra các góc: đặt CHECK_STAGE_DANCERS=1 rồi chạy node verify-preview.cjs.

BỤC TRUNG TÂM CHO 5 NHÂN VẬT 3D
- Bục bát giác ở giữa ba vòng tròn, dưới quả cầu disco; mặt bục cao 125, rộng 1040, sâu 580 theo tọa độ sân khấu.
- Có 5 vòng đánh dấu 01–05 xếp so le, viền neon và LED quanh thân. Hiện để trống cho các nhân vật sẽ thêm sau.
- Trong app.js: CENTER_STAGE là kích thước bục; CENTER_STAGE_SLOTS chứa id, x/y/z tại bàn chân và rotationY của 5 vị trí. Đây là các mốc để nối bộ render/model 3D sau này, chưa có bộ tải model 3D.
- Khán giả được bố trí vòng ngoài và đường đi bộ tránh bục. Bục DJ và 3 bục top xu giữ nguyên.
- Khoảng trống quanh bục: ít nhất 240 đơn vị ở hai bên/phía trước và 300 phía sau để hạn chế che nhân vật khi camera lướt. Vùng đứng và đường đi bộ đã nới rộng tương ứng.
- Tải lại bảng điều khiển và nguồn Link sân khấu để áp dụng; không cần khởi động lại máy chủ cho thay đổi này.
- Kiểm tra hình và khoảng trống: đặt CHECK_CENTER_STAGE=1 rồi chạy node verify-preview.cjs. Ảnh kiểm tra được lưu trong thư mục tạm Windows.

MEME VÀ ĐIỆU QUẨY MỚI / V16.6
- Thêm 4 mẫu (tổng 21): Gấu Đại Ca đeo kính, áo khoác dây chuyền; Gấu Cười Điên đội mũ, đeo nơ; Gấu Mít Ướt mặc đồ thể thao, đeo tai nghe; Nấm Bão đeo băng đô, áo số 99.
- Chat "gau dai ca", "gau cuoi dien", "gau mit uot", "nam bao" để chọn. Có nút thêm từng mẫu trong bảng điều khiển; mẫu được chọn tiếp tục dùng chung cho tặng xu và phi kiếm.
- Neuvillette luân phiên đấm chéo lực, xoay tay rộng và shuffle bật gối. Zhongli luân phiên bật nhảy nện tay, đấm chéo lực và xoay tay dậm chân. Chuyển động tác mỗi 4 nhịp với đoạn nối mềm, có lắc hông và nhún bật mạnh hơn.
- Đám đông có thêm 4 điệu mới; mỗi người lệch pha riêng. Các mẫu meme mới mặc định nhảy tay không.
- Đóng cửa sổ máy chủ cũ, chạy lại start.bat để nạp danh sách 21 nhân vật, sau đó tải lại bảng điều khiển và nguồn Link. Nếu đang phát LIVE, thực hiện khởi động lại sau buổi phát.
- Kiểm tra: node --test engine.test.js connection.test.js dance-motion.test.js. Có thể đặt RECORD_RAVE_DANCES=1 và PREVIEW_OUTPUT_DIR vào thư mục tạm trước khi chạy node verify-preview.cjs để kiểm tra hình chuyển động mà không tạo preview trong thư mục dự án.

ZOOM PHI KIẾM VÀ THỜI GIAN KHOE CÁNH / V16.7
- Camera tự zoom mượt và bám vị trí thật của người đang bay kiếm 10/20/50 xu, kể cả người thuộc top 3. Hạ cánh thì trở về toàn cảnh.
- Nếu nhiều người đang bay, camera theo lượt đang bay bắt đầu trước; sau đó chuyển sang người còn đang bay tiếp theo. Người vẫn chờ trong hàng đợi chưa được zoom.
- Rose/zoom và màn mở cánh được ưu tiên; sau khi kết thúc, camera tiếp tục theo lượt bay còn hoạt động.
- Năm bậc cánh 30/50/100/150/200 xu đều khoe lớn trong 5 giây; Phượng Hoàng 300 xu vẫn 15 giây. Thời gian này chỉ áp dụng màn khoe khi mở cánh, không phải thời hạn sở hữu cánh.
- Đóng máy chủ cũ rồi chạy start.bat để nạp bản 16.7; tải lại bảng điều khiển và nguồn Link sân khấu.
- Kiểm tra camera: đặt CHECK_SWORD_CAMERA=1 rồi chạy node verify-preview.cjs. Ảnh kiểm tra lưu trong thư mục tạm Windows.

PHI KIẾM KHÔNG KHOE CÁNH VÀ HUY HIỆU TOP / V16.8
- Quà phi kiếm 10/20/50 xu không bật màn khoe cánh, kể cả khi vừa đủ xu lên bậc cánh mới. Xu, VIP và cánh trang bị vẫn được nâng đúng mức; Phượng Hoàng cũng được trang bị nếu tổng xu đạt 300.
- Nếu chính người nhận kiếm đang khoe cánh, màn khoe đó kết thúc để nhường cho chuyến bay. Màn khoe của người khác vẫn được ưu tiên như trước; các lượt kiếm vẫn xếp hàng.
- Quà không phải phi kiếm vẫn khoe cánh mới trong 5 giây, riêng Phượng Hoàng 15 giây. Các nút Thử cánh dành riêng để xem hiệu ứng cánh, nên vẫn phát màn khoe.
- TOP 1/2/3 trên bục có huy hiệu vương miện, nguyệt quế, chữ TOP lớn và bảng số xu. Màu lần lượt vàng/bạc/đồng. Ô thứ hạng trong bảng góc phải cũng lớn hơn.
- Đóng máy chủ cũ, chạy start.bat rồi tải lại bảng điều khiển và nguồn Link để nạp bản 16.8.

ĐỘI HÌNH 5 DANCER 3D / V17.0
- Đã gắn năm model trong model_3d/Nam lên bục giữa. Neuvillette / Zhongli phía trước, Flins / Wriothesley / Childe phía sau.
- Chuyển động ước lượng từ video 402b đã cung cấp, cùng nhạc trích từ video. Một lượt khoảng 26,7 giây; hàng sau đổi chỗ nhanh cuối lượt.
- Có nhãn Dancer 1–5, sáng dưới chân và vệt sáng theo tay.
- Bảng điều khiển có phần phát nhạc, đổi đội hình, gán năm quà 5 xu và thử zoom từng dancer. Tên/mã quà cần điền theo quà thật trong tài khoản của bạn; ban đầu để chưa gán.
- Hướng dẫn chi tiết: DANCER-3D.txt. Đóng server cũ, chạy start.bat, tải lại bảng điều khiển và nguồn Link.

NĂM QUÀ 5 XU MẶC ĐỊNH / V17.1
- Dancer 1: Finger Heart 5487 (cũng nhận biến thể 5880).
- Dancer 2: Ice cream 7412.
- Dancer 3: Okay 8635.
- Dancer 4: Peach 10961.
- Dancer 5: Name shoutout 19445.
- Quà zoom đúng vị trí dancer trong 5 giây, yêu cầu giá mỗi món trong sự kiện đúng 5 xu. Note có biểu tượng để dễ nhận biết.
- Cấu hình cũ chưa gán quà sẽ được điền sẵn; cấu hình riêng đã lưu không bị thay thế. Có thể sửa trong mục ĐỘI HÌNH 5 DANCER 3D.
- Đối chiếu danh mục Việt Nam của LiveFinity ngày 09/11/2026. Xem nguồn và hướng dẫn ở DANCER-3D.txt.

SỬA CHÂN, TỐI ƯU VÀ DỌN SÀN / V17.2
- Giữ bàn chân phẳng, gối gập về trước; sửa trọng số đế giày Childe.
- Tính sẵn chuyển động, giảm cập nhật bộ xương lặp, cache phép chiếu và tách lớp nền nhẹ. Nhân vật và chữ giữ nguồn Full HD; toàn cảnh giảm tải render 3D, nhìn gần tự tăng độ nét.
- Dọn nhân vật người thật sau 5 phút không nhận tương tác/tín hiệu hiện diện; giữ xu và cánh. Người chỉ xem im lặng vẫn có thể bị dọn vì API không cung cấp danh sách kết nối đầy đủ. Có thể tắt ở mục TỰ DỌN SÀN.
- Không dọn năm dancer cố định hoặc nhân vật thử. Chat hey để vào lại.
- Đóng server cũ, chạy start.bat và tải lại nguồn Link để nạp bản 17.2.
- Kiểm tra: node --test engine.test.js connection.test.js dance-motion.test.js dancer-stage.test.js idle-viewers.test.js.
