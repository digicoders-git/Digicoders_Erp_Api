import mongoose from "mongoose";

const educationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },

    isActive: {
        type: Boolean,
        default: true
    },
    addedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"}
}, { timestamps: true });


const TechnologyModal = mongoose.model("Education", educationSchema);
export default TechnologyModal;