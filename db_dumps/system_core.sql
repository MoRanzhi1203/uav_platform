-- MySQL dump for system core: user management, system configuration, operation log
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
  UNIQUE KEY `username` (`username`)
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

--
-- Table structure for table `system_setting`
--

DROP TABLE IF EXISTS `system_setting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_setting` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(64) NOT NULL,
  `config_group` varchar(64) NOT NULL,
  `config_name` varchar(128) NOT NULL,
  `value_type` varchar(16) NOT NULL,
  `config_value` json NOT NULL,
  `options` json NOT NULL,
  `description` varchar(255) NOT NULL,
  `sort_order` int(10) unsigned NOT NULL,
  `updated_by` varchar(64) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`),
  KEY `system_setting_config_group_idx` (`config_group`),
  KEY `system_setting_sort_order_idx` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_setting`
--

LOCK TABLES `system_setting` WRITE;
/*!40000 ALTER TABLE `system_setting` DISABLE KEYS */;
INSERT INTO `system_setting` VALUES 
(1,'site_name','basic','平台名称','string','\"无人机群林农协同系统\"','[]','系统对外显示的名称',1,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(2,'default_region','basic','默认部署区域','string','\"重庆市\"','[]','系统默认工作区域',2,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(3,'session_timeout','basic','会话超时时间（分钟）','int','120','[]','登录会话有效期',3,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(4,'max_login_attempts','basic','最大登录失败次数','int','5','[]','连续失败锁定次数',4,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(5,'log_retention_days','basic','日志保留天数','int','90','[]','操作日志自动清理周期',5,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(6,'timezone','basic','系统时区','select','\"Asia/Shanghai\"','[\"Asia/Shanghai\", \"Asia/Urumqi\", \"Asia/Hong_Kong\"]','系统时间显示时区',6,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(7,'telemetry_interval','telemetry','遥测数据采集间隔（秒）','int','5','[]','无人机心跳和轨迹数据采集间隔',1,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(8,'heartbeat_timeout','telemetry','心跳超时判定（秒）','int','30','[]','超过时间无心跳判定离线',2,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(9,'trajectory_retention_days','telemetry','轨迹数据保留天数','int','30','[]','飞行轨迹历史数据留存期',3,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(10,'enable_federation','federation','启用跨库联邦查询','bool','true','[]','开启多数据库协同查询功能',1,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(11,'federation_timeout','federation','联邦查询超时（秒）','int','60','[]','跨库查询最大执行时间',2,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(12,'auto_dispatch','federation','启用自动任务调度','bool','false','[]','根据事件自动生成并分派任务',3,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(13,'password_min_length','security','密码最小长度','int','8','[]','用户密码强度要求',1,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(14,'require_password_change','security','强制定期修改密码','bool','false','[]','开启后每90天必须修改密码',2,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00'),
(15,'enable_ip_whitelist','security','启用IP白名单','bool','false','[]','仅白名单IP可登录管理后台',3,'admin','2026-04-11 13:00:00','2026-04-11 13:00:00');
/*!40000 ALTER TABLE `system_setting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_operation_log`
--

DROP TABLE IF EXISTS `system_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_operation_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `operator_id` bigint(20) NOT NULL,
  `operator_name` varchar(64) NOT NULL,
  `module` varchar(64) NOT NULL,
  `action` varchar(64) NOT NULL,
  `request_method` varchar(16) NOT NULL,
  `request_path` varchar(255) NOT NULL,
  `request_ip` varchar(64) NOT NULL,
  `extra_data` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `system_operation_log_module_idx` (`module`),
  KEY `system_operation_log_operator_idx` (`operator_name`),
  KEY `system_operation_log_created_at_idx` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_operation_log`
--

LOCK TABLES `system_operation_log` WRITE;
/*!40000 ALTER TABLE `system_operation_log` DISABLE KEYS */;
INSERT INTO `system_operation_log` VALUES 
(1,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 13:00:01.199198'),
(2,1,'admin','system','view_config','GET','/api/system/settings/','127.0.0.1','{}','2026-04-11 13:00:15.000000'),
(3,1,'admin','system','update_config','PUT','/api/system/settings/','127.0.0.1','{\"config_key\": \"site_name\", \"new_value\": \"无人机群林农协同系统\"}','2026-04-11 13:00:30.000000'),
(4,1,'admin','user','view_list','GET','/api/system/users/','127.0.0.1','{}','2026-04-11 13:01:00.000000'),
(5,1,'admin','user','create','POST','/api/system/users/','127.0.0.1','{\"username\": \"dispatcher01\", \"real_name\": \"张调度\"}','2026-04-11 13:02:00.000000'),
(6,1,'admin','user','create','POST','/api/system/users/','127.0.0.1','{\"username\": \"forest01\", \"real_name\": \"李林业\"}','2026-04-11 13:03:00.000000'),
(7,1,'admin','user','create','POST','/api/system/users/','127.0.0.1','{\"username\": \"agri01\", \"real_name\": \"王农业\"}','2026-04-11 13:04:00.000000'),
(8,1,'admin','user','create','POST','/api/system/users/','127.0.0.1','{\"username\": \"pilot01\", \"real_name\": \"赵飞手\"}','2026-04-11 13:05:00.000000'),
(9,2,'dispatcher01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 14:00:00.000000'),
(10,3,'forest01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 15:00:00.000000'),
(11,4,'agri01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 16:00:00.000000'),
(12,5,'pilot01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 17:00:00.000000'),
(13,1,'admin','system','view_logs','GET','/api/system/logs/','127.0.0.1','{}','2026-04-11 18:00:00.000000'),
(14,2,'dispatcher01','tasking','view_list','GET','/api/tasking/tasks/','127.0.0.1','{}','2026-04-11 19:00:00.000000'),
(15,1,'admin','system','logout','POST','/api/system/logout/','127.0.0.1','{}','2026-04-11 20:00:00.000000');
/*!40000 ALTER TABLE `system_operation_log` ENABLE KEYS */;
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
