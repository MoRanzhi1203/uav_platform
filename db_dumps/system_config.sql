-- MySQL dump for System Configuration Module
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

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
