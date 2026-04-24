import mongoose  from "mongoose";

const qrCodeSchama=new mongoose.Schema({
    name:{type:String,required:true},
    upi:{type:String,required:true,unique:true},
    bankName:{type:String,required:true},
    isActive:{type:Boolean,default:true},
    image:{
        url:{type:String},
        public_id:{type:String}
    }
},{timestamps:true})
export default mongoose.model("QrCode",qrCodeSchama)