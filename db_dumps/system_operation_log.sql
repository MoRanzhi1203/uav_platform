-- MySQL dump for Operation Log Module
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
  KEY `system_operation_log_created_at_idx` (`created_at`),
  KEY `system_operation_log_action_idx` (`action`)
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
(15,1,'admin','system','logout','POST','/api/system/logout/','127.0.0.1','{}','2026-04-11 20:00:00.000000'),
(16,1,'admin','system','view_config','GET','/api/system/settings/','127.0.0.1','{}','2026-04-12 09:00:00.000000'),
(17,1,'admin','system','update_config','PUT','/api/system/settings/','127.0.0.1','{\"config_key\": \"session_timeout\", \"new_value\": 180}','2026-04-12 09:05:00.000000'),
(18,3,'forest01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 10:00:00.000000'),
(19,3,'forest01','forest','view_patrol','GET','/api/forest/patrols/','127.0.0.1','{}','2026-04-12 10:15:00.000000'),
(20,4,'agri01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 11:00:00.000000'),
(21,4,'agri01','agri','view_farms','GET','/api/agri/farms/','127.0.0.1','{}','2026-04-12 11:30:00.000000'),
(22,2,'dispatcher01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 14:00:00.000000'),
(23,2,'dispatcher01','tasking','create_task','POST','/api/tasking/tasks/','127.0.0.1','{\"task_name\": \"森林巡检-0412\", \"scene_type\": \"forest\"}','2026-04-12 14:30:00.000000'),
(24,2,'dispatcher01','tasking','dispatch','POST','/api/tasking/dispatch/','127.0.0.1','{\"task_id\": 1, \"drone_group_id\": 1}','2026-04-12 15:00:00.000000'),
(25,1,'admin','system','view_logs','GET','/api/system/logs/','127.0.0.1','{\"page\": 1, \"page_size\": 20}','2026-04-12 16:00:00.000000'),
(26,1,'admin','user','update','PUT','/api/system/users/2/','127.0.0.1','{\"user_id\": 2, \"department\": \"高级调度中心\"}','2026-04-12 16:30:00.000000'),
(27,5,'pilot01','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-13 08:00:00.000000'),
(28,5,'pilot01','fleet','view_drones','GET','/api/fleet/drones/','127.0.0.1','{}','2026-04-13 08:30:00.000000'),
(29,1,'admin','system','view_config','GET','/api/system/settings/','127.0.0.1','{}','2026-04-13 10:00:00.000000'),
(30,1,'admin','system','export_logs','GET','/api/system/logs/export/','127.0.0.1','{\"date_start\": \"2026-04-01\", \"date_end\": \"2026-04-13\"}','2026-04-13 10:30:00.000000');
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
