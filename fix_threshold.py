import sys
import re

path = 'static/script.js'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix the `twistThreshold` in trackRepetitions logic
# Current: const twistThreshold = 0.08;
# New: const twistThreshold = Math.abs(landmarks[11].x - landmarks[12].x) * 0.8; // 80% of shoulder width
code = code.replace('const twistThreshold = 0.08; // 8% dari lebar layar sebagai batas putaran', 'const twistThreshold = Math.max(0.04, Math.abs(landmarks[11].x - landmarks[12].x) * 0.8); // 80% dari lebar bahu')

# 2. Fix updateFormFeedback for Russian Twists
# I will use regular expressions to replace the block safely ignoring the degree symbol.
pattern_feedback = re.compile(r"\} else if \(exercise === 'Russian twists'\) \{.*?\} else if \(exercise === 'Jumping Jacks'\) \{", re.DOTALL)
replacement_feedback = '''} else if (exercise === 'Russian twists') {
        // Hip: condong ~45 derajat dari vertikal = sudut pinggul 95-135
        if (angles.hip < 95) {
            feedbacks.push({ text: "Condong sedikit ke belakang (~45 derajat)!", good: false });
        } else if (angles.hip > 135) {
            feedbacks.push({ text: "Terlalu condong ke belakang! Tegakkan sedikit.", good: false });
        } else {
            feedbacks.push({ text: "Condong badan ideal (OK)", good: true });
        }
        
        if (!landmarks) return;
        const wristX = (landmarks[15].x + landmarks[16].x) / 2;
        const bodyX = (landmarks[11].x + landmarks[12].x + landmarks[23].x + landmarks[24].x) / 4;
        const bodyWidth = Math.abs(landmarks[11].x - landmarks[12].x);
        
        if (Math.abs(wristX - bodyX) < (bodyWidth * 0.5)) {
            feedbacks.push({ text: "Putar bahu dan tanganmu lebih jauh ke samping!", good: false });
        } else {
            feedbacks.push({ text: "Jangkauan putaran bagus", good: true });
        }
    } else if (exercise === 'Jumping Jacks') {'''
code = pattern_feedback.sub(replacement_feedback, code)

# 3. Fix init logic in trackRepetitions
pattern_init = re.compile(r"\} else if \(predictedExercise === 'Russian twists' && elbowAngle < 85\) \{.*?minHipAngle = hipAngle;.*?\}", re.DOTALL)
replacement_init = '''} else if (predictedExercise === 'Russian twists' && landmarks) {
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
code = pattern_init.sub(replacement_init, code)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print('Success')
