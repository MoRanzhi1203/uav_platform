-- MySQL dump for User Management Module
-- Date: 2026-04-29
-- Database: central_db

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `system_user`
--

DROP TABLE IF EXISTS `system_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `password` varchar(128) NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) NOT NULL,
  `first_name` varchar(150) NOT NULL,
  `last_name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL,
  `real_name` varchar(64) NOT NULL,
  `phone` varchar(32) NOT NULL,
  `user_type` varchar(32) NOT NULL,
  `roles` json NOT NULL,
  `department` varchar(128) NOT NULL,
  `region` varchar(128) NOT NULL,
  `last_login_ip` varchar(64) NOT NULL,
  `remark` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `system_user_user_type_idx` (`user_type`),
  KEY `system_user_region_idx` (`region`),
  KEY `system_user_is_active_idx` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_user`
--

LOCK TABLES `system_user` WRITE;
/*!40000 ALTER TABLE `system_user` DISABLE KEYS */;
INSERT INTO `system_user` VALUES 
(1,'pbkdf2_sha256$1000000$7cKJ0TXvNIk4bq2Omgnyd6$nhZttuBHul1wkr1m9UkBAkSBqImkwJuLeXsl+5TrhTM=','2026-04-28 20:36:06.728516',1,'admin','','','',1,1,'2026-04-11 12:59:37.165351','系统管理员','13800138000','super_admin','[\"super_admin\", \"dispatcher\", \"forest_officer\", \"agri_officer\"]','平台管理中心','重庆市','127.0.0.1','','2026-04-11 12:59:37.166354','2026-04-17 02:51:09.256892'),
(2,'pbkdf2_sha256$1000000$7cKJ0TXvNIk4bq2Omgnyd6$nhZttuBHul1wkr1m9UkBAkSBqImkwJuLeXsl+5TrhTM=','2026-04-28 20:36:06.728516',0,'dispatcher01','','','',1,1,'2026-04-11 12:59:37.165351','张调度','13800138001','dispatcher','[\"dispatcher\"]','调度中心','重庆市','127.0.0.1','','2026-04-11 12:59:37.166354','2026-04-17 02:51:09.256892'),
(3,'pbkdf2_sha256$1000000$7cKJ0TXvNIk4bq2Omgnyd6$nhZttuBHul1wkr1m9UkBAkSBqImkwJuLeXsl+5TrhTM=','2026-04-28 20:36:06.728516',0,'forest01','','','',1,1,'2026-04-11 12:59:37.165351','李林业','13800138002','forest_officer','[\"forest_officer\"]','林业站','四川省','127.0.0.1','','2026-04-11 12:59:37.166354','2026-04-17 02:51:09.256892'),
(4,'pbkdf2_sha256$1000000$7cKJ0TXvNIk4bq2Omgnyd6$nhZttuBHul1wkr1m9UkBAkSBqImkwJuLeXsl+5TrhTM=','2026-04-28 20:36:06.728516',0,'agri01','','','',1,1,'2026-04-11 12:59:37.165351','王农业','13800138003','agri_officer','[\"agri_officer\"]','农业站','云南省','127.0.0.1','','2026-04-11 12:59:37.166354','2026-04-17 02:51:09.256892'),
(5,'pbkdf2_sha256$1000000$7cKJ0TXvNIk4bq2Omgnyd6$nhZttuBHul1wkr1m9UkBAkSBqImkwJuLeXsl+5TrhTM=','2026-04-28 20:36:06.728516',0,'pilot01','','','',1,1,'2026-04-11 12:59:37.165351','赵飞手','13800138004','pilot','[\"dispatcher\"]','飞行队','重庆市','127.0.0.1','','2026-04-11 12:59:37.166354','2026-04-17 02:51:09.256892');
/*!40000 ALTER TABLE `system_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_user_groups`
--

DROP TABLE IF EXISTS `system_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_user_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `systemuser_id` bigint(20) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_user_groups_systemuser_id_group_id_80e3523a_uniq` (`systemuser_id`,`group_id`),
  KEY `system_user_groups_group_id_925e6bcb_fk_auth_group_id` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_user_user_permissions`
--

DROP TABLE IF EXISTS `system_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_user_user_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `systemuser_id` bigint(20) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_user_user_permiss_systemuser_id_permission_94a6ae3b_uniq` (`systemuser_id`,`permission_id`),
  KEY `system_user_user_per_permission_id_9339fa91_fk_auth_perm` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_role_permission`
--

DROP TABLE IF EXISTS `system_role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_role_permission` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `role_code` varchar(64) NOT NULL,
  `role_name` varchar(64) NOT NULL,
  `permissions` json NOT NULL,
  `description` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_code` (`role_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_role_permission`
--

LOCK TABLES `system_role_permission` WRITE;
/*!40000 ALTER TABLE `system_role_permission` DISABLE KEYS */;
INSERT INTO `system_role_permission` VALUES 
(1,'super_admin','超级管理员','[\"system:*\", \"fleet:*\", \"forest:*\", \"agri:*\", \"tasking:*\", \"federation:*\"]','平台最高权限角色','2026-04-11 12:59:37.414449','2026-04-17 02:51:09.267786'),
(2,'dispatcher','统一调度员','[\"tasking:view\", \"tasking:dispatch\", \"fleet:view\", \"federation:view\"]','负责跨库任务协同调度','2026-04-11 12:59:37.423012','2026-04-17 02:51:09.277091'),
(3,'forest_officer','林业专员','[\"forest:view\", \"forest:task\", \"federation:view\"]','负责森林巡检与火情监管','2026-04-11 12:59:37.430646','2026-04-17 02:51:09.289874'),
(4,'agri_officer','农业专员','[\"agri:view\", \"agri:task\", \"federation:view\"]','负责农业植保与病虫害监管','2026-04-11 12:59:37.436693','2026-04-17 02:51:09.298846');
/*!40000 ALTER TABLE `system_role_permission` ENABLE KEYS */;
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
