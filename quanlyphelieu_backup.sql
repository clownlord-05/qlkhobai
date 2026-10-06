-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: quanlyphelieu
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `at` datetime NOT NULL DEFAULT current_timestamp(),
  `ip` varchar(64) DEFAULT NULL,
  `msg` varchar(500) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES (4,'2026-10-05 09:14:55','127.0.0.1','LOGIN_FAIL quanlyphelieu123'),(5,'2026-10-05 09:15:06','127.0.0.1','LOGIN_FAIL quanlyphelieu123'),(6,'2026-10-05 09:15:24','127.0.0.1','LOGIN_OK quanlyphelieu123'),(7,'2026-10-05 09:52:25','127.0.0.1','LOGIN_OK quanlyphelieu123'),(8,'2026-10-05 09:55:28','127.0.0.1','LOGIN_OK quanlyphelieu123'),(9,'2026-10-05 09:56:41','127.0.0.1','LOGIN_OK quanlyphelieu123'),(10,'2026-10-05 09:56:53','127.0.0.1','LOGIN_OK quanlyphelieu123'),(11,'2026-10-05 09:58:48','127.0.0.1','LOGIN_OK quanlyphelieu123'),(12,'2026-10-05 10:34:12','127.0.0.1','LOGIN_OK quanlyphelieu123'),(13,'2026-10-05 10:40:54','127.0.0.1','LOGIN_OK quanlyphelieu123'),(14,'2026-10-05 10:41:04','127.0.0.1','LOGIN_OK quanlyphelieu123'),(15,'2026-10-05 10:41:44','127.0.0.1','LOGIN_OK quanlyphelieu123');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entries`
--

DROP TABLE IF EXISTS `entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `entries` (
  `id` varchar(32) NOT NULL,
  `type` enum('in','out') NOT NULL,
  `entry_time` datetime NOT NULL,
  `material_id` varchar(32) NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `qty` decimal(15,3) NOT NULL,
  `note` varchar(255) NOT NULL DEFAULT '',
  `created_by` varchar(32) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_time` (`entry_time`),
  KEY `fk_entry_mat` (`material_id`),
  CONSTRAINT `fk_entry_mat` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entries`
--

LOCK TABLES `entries` WRITE;
/*!40000 ALTER TABLE `entries` DISABLE KEYS */;
INSERT INTO `entries` VALUES ('462f57d83c654d10','in','2026-10-05 09:51:05','1f568e289f5c8865',45000.00,50.000,'Nhập lon nhôm',NULL,'2026-10-05 09:51:05'),('74ff5370c2628dcd','out','2026-10-05 09:51:05','c1ecb8d244a0e46f',160000.00,10.000,'Bán đồng lẻ',NULL,'2026-10-05 09:51:05'),('776a4db33f76c142','in','2026-10-03 09:51:05','4bd192c5c531e78d',10000.00,500.000,'Nhập lô sắt',NULL,'2026-10-05 09:51:05'),('8ae671706319','in','2026-10-05 08:00:00','4bd192c5c531e78d',10000.00,100.000,'Nhập kho (mẫu)','quanlyphelieu123','2026-10-05 10:42:44'),('9e777ef4ecd06c98','out','2026-10-04 21:51:05','4bd192c5c531e78d',12000.00,300.000,'Bán sắt cho nhà máy',NULL,'2026-10-05 09:51:05'),('a31f67aef4983cd9','in','2026-10-04 09:51:05','c1ecb8d244a0e46f',150000.00,20.000,'Nhập dây đồng',NULL,'2026-10-05 09:51:05'),('b4c739a76ae1','in','2026-10-01 09:58:00','a432a3593235f9c7',4000.00,12.000,'123','quanlyphelieu123','2026-10-05 10:01:16'),('d0658619bf6d','out','2026-10-05 08:00:00','c1ecb8d244a0e46f',150000.00,5.500,'Bán lẻ (mẫu)','quanlyphelieu123','2026-10-05 10:42:44');
/*!40000 ALTER TABLE `entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `materials`
--

DROP TABLE IF EXISTS `materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `materials` (
  `id` varchar(32) NOT NULL,
  `name` varchar(100) NOT NULL,
  `price` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materials`
--

LOCK TABLES `materials` WRITE;
/*!40000 ALTER TABLE `materials` DISABLE KEYS */;
INSERT INTO `materials` VALUES ('1f568e289f5c8865','Nhôm',45000.00),('4bd192c5c531e78d','Sắt',10000.00),('7a35832965d37ac9','Nhựa',15000.00),('a432a3593235f9c7','Giấy',4000.00),('c1ecb8d244a0e46f','Đồng',150000.00);
/*!40000 ALTER TABLE `materials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `price_history`
--

DROP TABLE IF EXISTS `price_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `price_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `changed_at` datetime NOT NULL,
  `material_id` varchar(32) NOT NULL,
  `old_price` decimal(15,2) DEFAULT NULL,
  `new_price` decimal(15,2) NOT NULL,
  `changed_by` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mat` (`material_id`),
  CONSTRAINT `fk_hist_mat` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `price_history`
--

LOCK TABLES `price_history` WRITE;
/*!40000 ALTER TABLE `price_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `price_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `username` varchar(32) NOT NULL,
  `salt` char(32) NOT NULL,
  `hash` char(128) NOT NULL,
  `role` enum('admin','user') NOT NULL DEFAULT 'user',
  `created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('quanlyphelieu123','2c4be21808a2bd0ecaf62ef79ccf89fe','a8cfc785a9d434477df6480e84832de0dd2797440e1931e5bd80ba64c32290901e01a91d29a578d707563ba0c7bbf955d656895c8e05b7c95efce3ff7e1dd6c6','admin','2026-10-05 09:10:21');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-05 10:50:30
