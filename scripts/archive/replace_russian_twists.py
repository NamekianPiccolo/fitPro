import sys

path = 'static/script.js'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update updateFormFeedback signature and call
code = code.replace('function updateFormFeedback(exercise, angles, spineAngle) {', 'function updateFormFeedback(exercise, angles, spineAngle, landmarks) {')
code = code.replace("updateFormFeedback(activeExercise !== 'None' ? activeExercise : (predictedLabel.textContent !== 'SIAP MEDETEKSI' ? predictedLabel.textContent : 'None'), computedAngles, spineAngle);", "updateFormFeedback(activeExercise !== 'None' ? activeExercise : (predictedLabel.textContent !== 'SIAP MEDETEKSI' ? predictedLabel.textContent : 'None'), computedAngles, spineAngle, landmarks);")

# 2. Update trackRepetitions signature and call
code = code.replace('function trackRepetitions(predictedExercise, kneeAngle, elbowAngle, shoulderAngle, hipAngle, spineAngle) {', 'function trackRepetitions(predictedExercise, kneeAngle, elbowAngle, shoulderAngle, hipAngle, spineAngle, landmarks) {')
code = code.replace('trackRepetitions(exerciseToTrack, kneeAngle, elbowAngle, shoulderAngle, hipAngle, spineAngle);', 'trackRepetitions(exerciseToTrack, kneeAngle, elbowAngle, shoulderAngle, hipAngle, spineAngle, landmarks);')

# 3. Replace Russian Twists reset from 'tucked' to 'center'
code = code.replace('''        } else if (trainingMode === 'Russian twists') {
            repStage = 'tucked';
        } else if (trainingMode === 'Pull ups') {''', '''        } else if (trainingMode === 'Russian twists') {
            repStage = 'center';
        } else if (trainingMode === 'Pull ups') {''')

# 4. Replace Russian Twists init logic inside trackRepetitions
target_init = '''        } else if (predictedExercise === 'Russian twists' && elbowAngle < 85) {
            activeExercise = 'Russian twists';
            repStage = 'tucked';
            currentRepIsGood = true;

            // Reset tracking stats
            minElbowAngle = elbowAngle;
            maxElbowAngle = elbowAngle;
            minHipAngle = hipAngle;

            repStateText.textContent = "Putar badan...";
            repStateText.className = "info-val highlight";
            formQualityText.textContent = "Condongkan badan & putar kiri-kanan";
            formQualityText.className = "info-val highlight";
        }'''
replacement_init = '''        } else if (predictedExercise === 'Russian twists' && landmarks) {
            activeExercise = 'Russian twists';
            repStage = 'center';
            currentRepIsGood = true;

            // Reset tracking stats
            minHipAngle = hipAngle;

            repStateText.textContent = "Putar badan...";
            repStateText.className = "info-val highlight";
            formQualityText.textContent = "Condongkan badan & putar kiri-kanan";
            formQualityText.className = "info-val highlight";
        }'''
code = code.replace(target_init, replacement_init)

# 5. Replace updateFormFeedback Russian Twists block
target_feedback = '''    } else if (exercise === 'Russian twists') {
        // Elbow: lengan menekuk ke depan, siku <= 100°
        if (angles.elbow > 100) {
            feedbacks.push({ text: "Luruskan lengan ke depan!", good: false });
        } else {
            feedbacks.push({ text: "Posisi lengan OK", good: true });
        }
        // Hip: condong ~45° dari vertikal = sudut pinggul 95°-125°
        if (angles.hip < 95) {
            feedbacks.push({ text: "Condong sedikit ke belakang (~45°)!", good: false });
        } else if (angles.hip > 125) {
            feedbacks.push({ text: "Terlalu condong ke belakang! Tegakkan sedikit.", good: false });
        } else {
            feedbacks.push({ text: "Condong badan ideal ✓ (OK)", good: true });
        }
    } else if (exercise === 'Jumping Jacks') {'''
replacement_feedback = '''    } else if (exercise === 'Russian twists') {
        // Hip: condong ~45° dari vertikal = sudut pinggul 95°-125°
        if (angles.hip < 95) {
            feedbacks.push({ text: "Condong sedikit ke belakang (~45°)!", good: false });
        } else if (angles.hip > 135) {
            feedbacks.push({ text: "Terlalu condong ke belakang! Tegakkan sedikit.", good: false });
        } else {
            feedbacks.push({ text: "Condong badan ideal ✓ (OK)", good: true });
        }
        
        if (!landmarks) return;
        const wristX = (landmarks[15].x + landmarks[16].x) / 2;
        const bodyX = (landmarks[11].x + landmarks[12].x + landmarks[23].x + landmarks[24].x) / 4;
        
        if (Math.abs(wristX - bodyX) < 0.05) {
            feedbacks.push({ text: "Putar bahu dan tanganmu lebih jauh ke samping!", good: false });
        } else {
            feedbacks.push({ text: "Jangkauan putaran bagus", good: true });
        }
    } else if (exercise === 'Jumping Jacks') {'''
code = code.replace(target_feedback, replacement_feedback)

# 6. Replace trackRepetitions Russian Twists block
target_logic = '''    } else if (activeExercise === 'Russian twists') {
        // Track peak angles
        minElbowAngle = Math.min(minElbowAngle, elbowAngle);
        maxElbowAngle = Math.max(maxElbowAngle, elbowAngle);
        minHipAngle = Math.min(minHipAngle, hipAngle);

        // Real-time posture check and feedback (Spine alignment check)
        if (spineAngle > 165) {
            currentRepIsGood = false;
            formQualityText.textContent = "Bad: Duduk Terlalu Tegak!";
            formQualityText.className = "info-val highlight-red";
            speakCorrection("Condongkan badan sedikit ke belakang");
        } else if (spineAngle < 140) {
            currentRepIsGood = false;
            formQualityText.textContent = "Bad: Terlalu Condong ke Belakang!";
            formQualityText.className = "info-val highlight-red";
            speakCorrection("Tegakkan badan sedikit");
        } else {
            if (!currentRepIsGood) {
                formQualityText.textContent = "Form Buruk! Rep ditolak.";
                formQualityText.className = "info-val highlight-red";
            } else {
                formQualityText.textContent = `Putaran OK! condong: ${Math.round(spineAngle)}°`;
                formQualityText.className = "info-val highlight-green";
            }
        }

        // State machine using pendulum arm flexion/extension
        if (repStage === 'tucked') {
            if (elbowAngle > 100) {
                repStage = 'extended_1';
                repStateText.textContent = "Satu Sisi...";
                repStateText.className = "info-val highlight";
            }
        } else if (repStage === 'extended_1') {
            if (elbowAngle < 85) {
                repStage = 'tucked_1';
                repStateText.textContent = "Tengah (Lanjut sisi seberang)...";
                repStateText.className = "info-val highlight";
            }
        } else if (repStage === 'tucked_1') {
            if (elbowAngle > 100) {
                repStage = 'extended_2';
                repStateText.textContent = "Sisi Seberang...";
                repStateText.className = "info-val highlight";
            }
        } else if (repStage === 'extended_2') {
            if (elbowAngle < 85) {
                // Returned back to camera side! Complete 1 rep
                if (!currentRepIsGood || spineAngle > 165) {
                    repStateText.textContent = "Rep Ditolak!";
                    repStateText.className = "info-val highlight-red";
                    formQualityText.textContent = "Gagal: Duduk Terlalu Tegak";
                    formQualityText.className = "info-val highlight-red";
                    playSound('warning');
                    speakCorrection("Duduk terlalu tegak");
                } else if (spineAngle < 140) {
                    repStateText.textContent = "Rep Ditolak!";
                    repStateText.className = "info-val highlight-red";
                    formQualityText.textContent = "Gagal: Terlalu Condong ke Belakang";
                    formQualityText.className = "info-val highlight-red";
                    playSound('warning');
                    speakCorrection("Tegakkan badan sedikit");
                } else {
                    repCount++;
                    repCounterText.textContent = repCount;
                    repStateText.textContent = "Rep Selesai!";
                    repStateText.className = "info-val highlight-green";
                    formQualityText.textContent = "Sempurna (+1)";
                    formQualityText.className = "info-val highlight-green";
                    triggerHapticFeedback();
                    playSound('success');
                    speakText(repCount.toString());
                }

                // Release lock & reset states
                activeExercise = 'None';
            }
        }
    } else if (activeExercise === 'Jumping Jacks') {'''

replacement_logic = '''    } else if (activeExercise === 'Russian twists') {
        minHipAngle = Math.min(minHipAngle, hipAngle);

        // Real-time posture check and feedback (Spine alignment check)
        if (spineAngle > 160) {
            currentRepIsGood = false;
            formQualityText.textContent = "Bad: Duduk Terlalu Tegak!";
            formQualityText.className = "info-val highlight-red";
            speakCorrection("Condongkan badan sedikit ke belakang");
        } else if (spineAngle < 110) {
            currentRepIsGood = false;
            formQualityText.textContent = "Bad: Terlalu Condong ke Belakang!";
            formQualityText.className = "info-val highlight-red";
            speakCorrection("Tegakkan badan sedikit");
        } else {
            if (!currentRepIsGood) {
                formQualityText.textContent = "Form Buruk! Rep ditolak.";
                formQualityText.className = "info-val highlight-red";
            } else {
                formQualityText.textContent = `Putaran OK! condong: ${Math.round(spineAngle)}°`;
                formQualityText.className = "info-val highlight-green";
            }
        }

        // Hitung posisi horizontal (X) dari pusat badan dan pergelangan tangan
        if (!landmarks) return;
        const wristX = (landmarks[15].x + landmarks[16].x) / 2;
        const bodyX = (landmarks[11].x + landmarks[12].x + landmarks[23].x + landmarks[24].x) / 4;
        const twistThreshold = 0.08; // 8% dari lebar layar sebagai batas putaran

        // State machine using Wrist X-position relative to Body Center
        if (repStage === 'center') {
            if (wristX > bodyX + twistThreshold) {
                repStage = 'left';
                repStateText.textContent = "Putar Kiri...";
                repStateText.className = "info-val highlight";
            } else if (wristX < bodyX - twistThreshold) {
                repStage = 'right';
                repStateText.textContent = "Putar Kanan...";
                repStateText.className = "info-val highlight";
            }
        } else if (repStage === 'left') {
            if (wristX < bodyX - twistThreshold) {
                // Berpindah dari kiri penuh ke kanan penuh = 1 repetisi selesai
                if (!currentRepIsGood || spineAngle > 160) {
                    repStateText.textContent = "Rep Ditolak!";
                    repStateText.className = "info-val highlight-red";
                    formQualityText.textContent = "Gagal: Duduk Terlalu Tegak";
                    formQualityText.className = "info-val highlight-red";
                    playSound('warning');
                    speakCorrection("Duduk terlalu tegak");
                } else {
                    repCount++;
                    repCounterText.textContent = repCount;
                    repStateText.textContent = "Rep Selesai!";
                    repStateText.className = "info-val highlight-green";
                    formQualityText.textContent = "Sempurna (+1)";
                    formQualityText.className = "info-val highlight-green";
                    triggerHapticFeedback();
                    playSound('success');
                    speakText(repCount.toString());
                }

                // Reset untuk putaran selanjutnya
                currentRepIsGood = true;
                repStage = 'right'; // siap untuk putar balik ke kiri
            }
        } else if (repStage === 'right') {
            if (wristX > bodyX + twistThreshold) {
                // Berpindah dari kanan penuh ke kiri penuh = 1 repetisi selesai
                if (!currentRepIsGood || spineAngle > 160) {
                    repStateText.textContent = "Rep Ditolak!";
                    repStateText.className = "info-val highlight-red";
                    formQualityText.textContent = "Gagal: Duduk Terlalu Tegak";
                    formQualityText.className = "info-val highlight-red";
                    playSound('warning');
                    speakCorrection("Duduk terlalu tegak");
                } else {
                    repCount++;
                    repCounterText.textContent = repCount;
                    repStateText.textContent = "Rep Selesai!";
                    repStateText.className = "info-val highlight-green";
                    formQualityText.textContent = "Sempurna (+1)";
                    formQualityText.className = "info-val highlight-green";
                    triggerHapticFeedback();
                    playSound('success');
                    speakText(repCount.toString());
                }

                // Reset untuk putaran selanjutnya
                currentRepIsGood = true;
                repStage = 'left'; // siap untuk putar balik ke kanan
            }
        }
    } else if (activeExercise === 'Jumping Jacks') {'''
code = code.replace(target_logic, replacement_logic)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Check:")
if target_logic in code:
    print('Failed to replace target_logic!')
else:
    print('Logic replaced successfully!')
if target_feedback in code:
    print('Failed to replace target_feedback!')
else:
    print('Feedback replaced successfully!')
if target_init in code:
    print('Failed to replace target_init!')
else:
    print('Init replaced successfully!')
