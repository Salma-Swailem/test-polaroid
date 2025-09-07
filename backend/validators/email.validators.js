const Joi = require("joi");
const dns = require("dns").promises;
const disposableDomains = require("disposable-email-domains");
const isDisposableEmail = require("is-disposable-email");

const disposableSet = new Set(disposableDomains);

const emailValidator = Joi.string()
  .email({ tlds: { allow: true } })
  .custom(async (value, helpers) => {
    const domain = value.split("@")[1].toLowerCase();

    // 1. Block known disposable domains
    if (disposableSet.has(domain)) {
      return helpers.error("any.invalid", { message: "Disposable email detected" });
    }

    // 2. Check with is-disposable-email library
    if (isDisposableEmail(value)) {
      return helpers.error("any.invalid", { message: "Disposable email detected" });
    }

    // 3. Check MX records (real mail server exists)
    try {
      const records = await dns.resolveMx(domain);
      if (!records || records.length === 0) {
        return helpers.error("any.invalid", { message: "No MX records found" });
      }
    } catch (err) {
      return helpers.error("any.invalid", { message: "Invalid email domain" });
    }

    return value;
  }, "Advanced email validation");

// Wrapper for validation (async because MX lookup is async)
async function validateEmail(email) {
  try {
    const result = await emailValidator.validateAsync(email);
    console.log(`${result} ✅ Valid email`);
    return true;
  } catch (err) {
    console.log(`${email} ❌ Invalid -> ${err.message}`);
    return false;
  }
}

module.exports = validateEmail;

