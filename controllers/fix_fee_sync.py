import re

with open("../controllers/feeController.js", "r") as f:
    content = f.read()

# 1. Add import
if "import { syncRegistrationFees }" not in content:
    content = content.replace('import Fee from "../models/fee.js";', 'import Fee from "../models/fee.js";\nimport { syncRegistrationFees } from "../helpers/syncFee.js";')

# 2. In createFee
# find:
'''
    // Update registration payment status (sirf non-payment_link aur non-pending modes mein)
    if (mode !== "payment_link" && finalTnxStatus !== "pending") {
      registration.paidAmount = paidAmount;
      registration.dueAmount = dueAmount;
      
      // Auto-update training fee status based on due amount
      if (dueAmount === 0) {
        registration.trainingFeeStatus = "full paid";
        registration.tnxStatus = "full paid";
        // Update current fee record to show full paid status
        fee.tnxStatus = "full paid";
        await fee.save();
      } else if (paidAmount > 0) {
        registration.trainingFeeStatus = "partial";
        registration.tnxStatus = "paid";
      } else {
        registration.trainingFeeStatus = "pending";
        registration.tnxStatus = "pending";
      }
      
      await registration.save();
    }
'''
block_create = re.search(r'// Update registration payment status \(sirf non-payment_link.*?await registration\.save\(\);\n    }', content, re.DOTALL)
if block_create:
    replacement = '''    if (mode !== "payment_link" && finalTnxStatus !== "pending") {
      await syncRegistrationFees(registration._id);
      if (dueAmount === 0) {
        fee.tnxStatus = "full paid";
        await fee.save();
      }
    }'''
    content = content.replace(block_create.group(0), replacement)

# 3. In updateFeeStatus (verifyFeePaymentLink)
block_verify = re.search(r'// Update registration payment status\n        if \(registration\) \{\n          registration\.paidAmount.*?await registration\.save\(\);', content, re.DOTALL)
if block_verify:
    replacement = '''// Update registration payment status
        if (registration) {
          await syncRegistrationFees(registration._id);'''
    content = content.replace(block_verify.group(0), replacement)


# 4. In editPaymentAmount
block_edit = re.search(r"// Update registration amounts if payment was accepted\n    if \(feeRecord\.status === 'accepted'\) \{\n      registration\.paidAmount = Number\(registration\.paidAmount\).*?await feeRecord\.save\(\);\n    \}", content, re.DOTALL)
if block_edit:
    replacement = '''// Update registration amounts if payment was accepted
    if (feeRecord.status === 'accepted') {
      await syncRegistrationFees(registration._id);
      if (registration.dueAmount === 0) {
        feeRecord.tnxStatus = 'full paid';
      } else if (registration.paidAmount > 0) {
        feeRecord.tnxStatus = 'paid';
      }
      await feeRecord.save();
    }'''
    content = content.replace(block_edit.group(0), replacement)

with open("../controllers/feeController.js", "w") as f:
    f.write(content)
print("feeController.js updated")
