const strengthLabels = [
    "muito_fraca",
    "fraca",
    "media",
    "forte",
    "muito_forte",
];

export function evaluatePasswordStrength(password) {
    const normalizedPassword = String(password ?? "");
    const checks = [
        {
            id: "minLength",
            label: "Pelo menos 8 caracteres",
            passed: normalizedPassword.length >= 8,
        },
        {
            id: "lowercase",
            label: "Pelo menos uma letra minuscula",
            passed: /[a-z]/.test(normalizedPassword),
        },
        {
            id: "uppercase",
            label: "Pelo menos uma letra maiuscula",
            passed: /[A-Z]/.test(normalizedPassword),
        },
        {
            id: "number",
            label: "Pelo menos um numero",
            passed: /\d/.test(normalizedPassword),
        },
        {
            id: "symbol",
            label: "Pelo menos um simbolo",
            passed: /[^A-Za-z0-9]/.test(normalizedPassword),
        },
        {
            id: "longLength",
            label: "12 caracteres ou mais",
            passed: normalizedPassword.length >= 12,
        },
    ];

    const score = checks.reduce((total, check) => total + Number(check.passed), 0);
    const percentage = Math.round((score / checks.length) * 100);
    const label = strengthLabels[Math.max(0, Math.min(score - 1, strengthLabels.length - 1))];
    const suggestions = checks.filter((check) => !check.passed).map((check) => check.label);
    const requiredChecksPassed =
        checks.find((check) => check.id === "minLength")?.passed === true &&
        checks.find((check) => check.id === "lowercase")?.passed === true &&
        checks.find((check) => check.id === "uppercase")?.passed === true &&
        checks.find((check) => check.id === "number")?.passed === true &&
        checks.find((check) => check.id === "symbol")?.passed === true;

    return {
        score,
        label,
        percentage,
        isValid: requiredChecksPassed,
        checks,
        suggestions,
    };
}
