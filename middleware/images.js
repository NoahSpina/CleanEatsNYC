import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "..");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(rootDir, "public/uploads"));
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const images = multer({ storage });

export default images;

//https://www.npmjs.com/package/multer