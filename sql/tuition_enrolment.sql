-- MySQL dump 10.13  Distrib 8.0.22, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: tuition
-- ------------------------------------------------------
-- Server version	5.5.5-10.6.4-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `enrolment`
--

DROP TABLE IF EXISTS `enrolment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enrolment` (
  `enrolment_id` int(11) NOT NULL AUTO_INCREMENT,
  `lesson_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `quoted_price` varchar(45) CHARACTER SET utf8mb4 DEFAULT NULL,
  `estimated` varchar(45) CHARACTER SET utf8mb4 DEFAULT NULL,
  `received` varchar(45) CHARACTER SET utf8mb4 DEFAULT NULL,
  `payment_status` varchar(45) CHARACTER SET utf8mb4 DEFAULT NULL,
  `payment_remark` varchar(45) CHARACTER SET utf8mb4 DEFAULT NULL,
  `paid_on` varchar(45) CHARACTER SET utf8mb4 DEFAULT NULL,
  `payment_verified` int(11) DEFAULT NULL,
  `year` int(11) DEFAULT NULL,
  `month` varchar(45) CHARACTER SET utf8mb4 DEFAULT NULL,
  `attendance1` varchar(45) COLLATE utf8mb4_bin DEFAULT NULL,
  `attendance2` varchar(45) COLLATE utf8mb4_bin DEFAULT NULL,
  `attendance3` varchar(45) COLLATE utf8mb4_bin DEFAULT NULL,
  `attendance4` varchar(45) COLLATE utf8mb4_bin DEFAULT NULL,
  `attendance5` varchar(45) COLLATE utf8mb4_bin DEFAULT NULL,
  `attendance6` varchar(45) COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`enrolment_id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2022-07-01 18:51:30
