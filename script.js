document.addEventListener('DOMContentLoaded', () => {
    const mealDateInput = document.getElementById('mealDate');
    const searchBtn = document.getElementById('searchBtn');
    const mealInfoDiv = document.getElementById('mealInfo');

    searchBtn.addEventListener('click', fetchMealInfo);

    async function fetchMealInfo() {
        const selectedDate = mealDateInput.value.replace(/-/g, ''); // YYYYMMDD 형식으로 변경
        const apiUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7130118&MLSV_YMD=${selectedDate}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "application/xml");

            const errorCode = xmlDoc.querySelector('result code')?.textContent;
            const errorMessage = xmlDoc.querySelector('result message')?.textContent;
            if (errorCode && errorCode !== 'INFO-000') {
                Swal.fire({
                    icon: 'error',
                    title: '오류 발생!',
                    text: `급식 정보를 가져오는 중 오류가 발생했습니다: ${errorMessage || '알 수 없는 오류'}`,
                });
                mealInfoDiv.innerHTML = ''; // 오류 발생 시 급식 정보 초기화
                return;
            }

            const meals = xmlDoc.querySelectorAll('row');
            if (meals.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: '정보 없음',
                    text: '해당 날짜의 급식 정보가 없습니다.',
                });
                mealInfoDiv.innerHTML = ''; // 정보 없을 시 급식 정보 초기화
                return;
            }

            let mealHtml = '<h2 class="text-2xl font-semibold mb-4 text-gray-700">급식 정보</h2>';
            meals.forEach(meal => {
                const menu = meal.querySelector('DDISH_NM')?.textContent || '메뉴 없음';
                const mealTime = meal.querySelector('MMEAL_SC_NM')?.textContent || '시간 정보 없음';
                const calorie = meal.querySelector('CAL_INFO')?.textContent || '열량 정보 없음';
                const ntrInfo = meal.querySelector('NTR_INFO')?.textContent || '';

                let parsedNutrients = {};
                if (ntrInfo) {
                    const nutrientLines = ntrInfo.split('<br/>').map(line => line.trim()).filter(line => line !== '');
                    nutrientLines.forEach(line => {
                        const match = line.match(/(.+)\(.+?\)\s*:\s*(.+)/);
                        if (match && match[1] && match[2]) {
                            parsedNutrients[match[1].trim()] = match[2].trim();
                        }
                    });
                }

                let nutritionHtml = '<div class="mt-2 text-sm text-gray-700"><strong>영양 정보:</strong><ul class="list-none pl-0 mt-1 space-y-1">';
                const nutrientEmojis = {
                    '탄수화물': '🍚',
                    '단백질': '🍗',
                    '지방': '🥑',
                    '비타민A': '🥕',
                    '티아민': '🍞',
                    '리보플라빈': '🥛',
                    '비타민C': '🍊',
                    '칼슘': '🦴',
                    '철분': '🍎',
                };

                for (const nutrientName in parsedNutrients) {
                    const emoji = nutrientEmojis[nutrientName] || '✨';
                    nutritionHtml += `<li class="flex items-center"><span class="mr-1">${emoji}</span>${nutrientName}: ${parsedNutrients[nutrientName]}</li>`;
                }
                nutritionHtml += '</ul></div>';

                mealHtml += `<div class="mb-4 p-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                                <h3 class="text-xl font-medium mb-2 text-gray-600 flex items-center justify-between">
                                    <span>🍽️ ${mealTime}</span>
                                    <span class="text-sm text-gray-500 font-normal">🔥 ${calorie}</span>
                                </h3>
                                <p class="text-gray-800 mb-2">${menu.replace(/<br\/>/g, ', ').replace(/\([^\)]+\)/g, '').trim()}</p>
                                ${nutritionHtml}
                              </div>`;
            });

            // 동적 저녁 추천 메뉴 생성 함수
            function generateDynamicDinnerRecommendation(meals, targetAudience) {
                const totalNutrients = {
                    탄수화물: 0, 단백질: 0, 지방: 0, 비타민A: 0, 비타민C: 0, 칼슘: 0, 철분: 0, calorie: 0
                };

                meals.forEach(meal => {
                    const ntrInfo = meal.querySelector('NTR_INFO')?.textContent || '';
                    const calorieInfo = meal.querySelector('CAL_INFO')?.textContent || '0 Kcal';
                    const parsedCalorie = parseFloat(calorieInfo.replace(/[^0-9.]/g, '')) || 0;
                    totalNutrients.calorie += parsedCalorie; // 급식 총 칼로리 합산

                    if (ntrInfo) {
                        const nutrientLines = ntrInfo.split('<br/>').map(line => line.trim()).filter(line => line !== '');
                        nutrientLines.forEach(line => {
                            const match = line.match(/(.+)\(.+?\)\s*:\s*(.+)/);
                            if (match && match[1] && match[2]) {
                                const nutrientName = match[1].trim();
                                const nutrientValue = parseFloat(match[2].trim()) || 0;
                                if (totalNutrients[nutrientName] !== undefined) {
                                    totalNutrients[nutrientName] += nutrientValue;
                                }
                            }
                        });
                    }
                });

                let recommendation = '';
                let dinnerMenu = [];

                // 대상별 영양소 기준 (임의 설정)
                const nutrientThresholds = {
                    elementary: {
                        protein: 20, // 초등학생 단백질 기준 (g)
                        carbohydrate: 80, // 초등학생 탄수화물 기준 (g)
                        vitaminC: 30, // 초등학생 비타민C 기준 (mg)
                        calcium: 300, // 초등학생 칼슘 기준 (mg)
                        calorie: 600 // 초등학생 점심 예상 칼로리 (Kcal), 점심+저녁 합산 고려
                    },
                    adult: {
                        protein: 40, // 성인 단백질 기준 (g)
                        carbohydrate: 150, // 성인 탄수화물 기준 (g)
                        vitaminC: 60, // 성인 비타민C 기준 (mg)
                        calcium: 600, // 성인 칼슘 기준 (mg)
                        calorie: 800 // 성인 점심 예상 칼로리 (Kcal), 점심+저녁 합산 고려
                    }
                };

                const thresholds = nutrientThresholds[targetAudience];

                // 추천 메뉴 후보 목록
                const recommendationPool = {
                    proteinDeficient: [
                        { menu: '🍗 닭가슴살 샐러드', reason: `단백질이 부족할 수 있어요. ${targetAudience === 'elementary' ? '성장기' : '건강 유지에'} 중요한 단백질을 보충해 주세요.` },
                        { menu: '🥩 소고기 스테이크', reason: `양질의 단백질 섭취로 근육 강화와 활력을 높여주세요.` },
                        { menu: '🥚 달걀말이와 두부 조림', reason: `부담 없이 즐길 수 있는 단백질 풍부 메뉴입니다.` },
                        { menu: '🐟 고등어구이', reason: `오메가-3와 단백질을 한 번에 섭취할 수 있는 생선 요리입니다.` }
                    ],
                    carbohydrateDeficient: [
                        { menu: '🍠 고구마 또는 현미밥', reason: `활동에 필요한 에너지를 위해 탄수화물을 보충해 주세요.` },
                        { menu: '🍞 통곡물 샌드위치', reason: `복합 탄수화물로 포만감을 주고 에너지 지속에 도움을 줍니다.` },
                        { menu: '🍜 잡채밥', reason: `다양한 채소와 함께 맛있는 탄수화물을 섭취해 보세요.` },
                        { menu: '🥟 만둣국', reason: `따뜻한 국물과 함께 든든한 탄수화물을 섭취해 보세요.` }
                    ],
                    vitaminCDeficient: [
                        { menu: '🍓 과일 샐러드', reason: `면역력 증진에 좋은 비타민C를 섭취해 보세요.` },
                        { menu: '🌶️ 파프리카 볶음', reason: `싱싱한 채소로 비타민C를 채워주세요.` },
                        { menu: '🥝 키위 또는 딸기', reason: `간편하게 비타민C를 보충할 수 있는 과일입니다.` },
                        { menu: '🥬 겉절이', reason: `새콤달콤한 겉절이로 비타민C를 맛있게 보충해 보세요.` }
                    ],
                    calciumDeficient: [
                        { menu: '🥛 저지방 우유 또는 요거트', reason: `뼈 건강에 필수적인 칼슘을 보충해 주세요.` },
                        { menu: '🐟 멸치볶음', reason: `칼슘 섭취에 좋은 한국인의 밥상 메뉴입니다.` },
                        { menu: '🥦 브로콜리 스프', reason: `부드러운 스프에 칼슘을 더해 보세요.` },
                        { menu: '🧀 치즈 스틱', reason: `간편하게 칼슘을 섭취할 수 있는 간식입니다.` }
                    ],
                    calorieDeficient: [
                        { menu: '🍞 시리얼과 우유', reason: `간단하게 에너지를 보충할 수 있는 식사입니다.` },
                        { menu: '🍌 바나나와 견과류', reason: `건강한 지방과 탄수화물로 칼로리를 채워주세요.` },
                        { menu: '🥞 팬케이크 (소량) ', reason: `부족한 칼로리를 맛있게 채울 수 있는 간식입니다.` },
                        { menu: '🍚 주먹밥', reason: `든든하고 간편하게 칼로리를 보충해 보세요.` }
                    ]
                };

                // 급식 식단에 부족한 영양소를 보충하는 저녁 메뉴 추천
                if (targetAudience === 'elementary' && totalNutrients.calorie < thresholds.calorie) {
                    const item = recommendationPool.calorieDeficient[Math.floor(Math.random() * recommendationPool.calorieDeficient.length)];
                    dinnerMenu.push(item);
                }

                if (totalNutrients.단백질 < thresholds.protein) {
                    const item = recommendationPool.proteinDeficient[Math.floor(Math.random() * recommendationPool.proteinDeficient.length)];
                    dinnerMenu.push(item);
                }
                if (totalNutrients.탄수화물 < thresholds.carbohydrate) {
                    const item = recommendationPool.carbohydrateDeficient[Math.floor(Math.random() * recommendationPool.carbohydrateDeficient.length)];
                    dinnerMenu.push(item);
                }
                if (totalNutrients.비타민C < thresholds.vitaminC) {
                    const item = recommendationPool.vitaminCDeficient[Math.floor(Math.random() * recommendationPool.vitaminCDeficient.length)];
                    dinnerMenu.push(item);
                }
                if (totalNutrients.칼슘 < thresholds.calcium) {
                    const item = recommendationPool.calciumDeficient[Math.floor(Math.random() * recommendationPool.calciumDeficient.length)];
                    dinnerMenu.push(item);
                }

                if (dinnerMenu.length === 0) {
                    recommendation = `<p class="text-gray-800">🌟 오늘의 급식은 ${targetAudience === 'elementary' ? '초등학생' : '성인'} 기준 충분히 균형 잡힌 식단이네요! 건강한 저녁 식사하세요.</p>`;
                } else {
                    recommendation = `<p class="text-gray-800 mb-2">오늘 급식 영양소 분석 결과, ${targetAudience === 'elementary' ? '초등학생' : '성인'}에게 다음 저녁 메뉴를 추천합니다:</p><ul class="list-disc pl-5 space-y-1">`;
                    dinnerMenu.forEach(item => {
                        recommendation += `<li><strong>${item.menu}</strong>: ${item.reason}</li>`;
                    });
                    recommendation += '</ul>';
                }
                return recommendation;
            }

            mealInfoDiv.innerHTML = mealHtml;

            // 동적 저녁 추천 메뉴 섹션 추가
            mealInfoDiv.innerHTML += `
                <div class="mt-8 pt-6 border-t border-gray-200 text-left space-y-4">
                    <h2 class="text-2xl font-semibold mb-4 text-gray-700">🌙 균형 잡힌 저녁 추천 메뉴</h2>
                    <div class="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        ${generateDynamicDinnerRecommendation(meals, 'adult')}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('급식 정보를 가져오는 중 오류 발생:', error);
            Swal.fire({
                icon: 'error',
                title: '네트워크 오류',
                text: '급식 정보를 가져오는 중 네트워크 오류가 발생했습니다. 다시 시도해주세요.',
            });
            mealInfoDiv.innerHTML = ''; // 오류 발생 시 급식 정보 초기화
        }
    }

    // 페이지 로드 시 오늘 날짜의 급식 정보 자동 로드
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    mealDateInput.value = `${year}-${month}-${day}`;

    // 초기 안내 메시지 표시
    mealInfoDiv.innerHTML = '<p class="text-gray-600 text-lg">날짜를 선택하고 급식 조회 버튼을 눌러주세요.</p>';
});
