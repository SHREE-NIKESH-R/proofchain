const express = require("express");
const { publicVerify, publicSearch } = require("../controllers/assetController");

const router = express.Router();

router.get("/search", publicSearch);
router.get("/verify/:assetId", publicVerify);

module.exports = router;
