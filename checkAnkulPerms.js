import mongoose from "mongoose";
import User from "./models/User.js";
import EmployeePermission from "./models/EmployeePermission.js";
import Permission from "./models/Permission.js";
import dotenv from "dotenv";

dotenv.config();

async function checkAnkulPerms() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Ensure Permission model is registered
    const permSchema = new mongoose.Schema({ name: String, category: String, description: String });
    const PermModel = mongoose.models.Permission || mongoose.model('Permission', permSchema);

    const user = await User.findOne({ email: "ankul@gmail.com" });
    if (!user) {
      console.log("Not found");
      return;
    }

    const perms = await EmployeePermission.findOne({ employee: user._id }).populate("permissions", "name");
    console.log("Ankul Permissions from DB:");
    if (perms && perms.permissions) {
      perms.permissions.forEach(p => console.log(p.name));
    } else {
      console.log("No explicit permissions");
    }

  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}
checkAnkulPerms();
